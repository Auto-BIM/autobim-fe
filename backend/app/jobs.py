"""변환 작업 — 요청 안에서 변환하지 않는다. 작업을 대기열에 넣고, 상태는 jobs/<id>.json에 남긴다.

REDIS_URL이 있으면 RQ 작업 처리기(worker 컨테이너)가 돌린다.
없으면(로컬 개발) API 프로세스의 스레드에서 돌린다 — 이 "빠른 길"은 동시 작업 수 제한·재시작 복구를 포기한다.
"""
from __future__ import annotations

import logging
import threading
import traceback
import uuid
from datetime import datetime, timezone

from . import storage
from .config import JOB_TIMEOUT_S, REDIS_URL
from .convert import ConvertError, Options, convert
from .dxf_reader import DxfError, read_drawing

log = logging.getLogger("jobs")
STEPS = ["접수", "도면 읽기", "벽 찾기", "벽 세우기", "파일 만들기", "완료"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def job_path(job_id: str):
    return storage.path("jobs", f"{storage.check_id(job_id)}.json")


def get(job_id: str) -> dict | None:
    return storage.read_json(job_path(job_id))


def _update(job_id: str, **fields) -> None:
    cur = get(job_id) or {}
    cur.update(fields, updatedAt=_now())
    storage.write_json(job_path(job_id), cur)


def run(job_id: str) -> None:
    """작업 처리기가 실행하는 함수 (RQ가 이 이름으로 부른다)."""
    job = get(job_id)
    if not job:
        return
    upload_id = job["uploadId"]
    src = storage.path("uploads", upload_id, "source.dxf")
    out = storage.path("results", job_id)

    def progress(step: str, pct: int):
        _update(job_id, status="running", step=step, progress=pct)

    try:
        progress("도면 읽기", 10)
        drawing = read_drawing(src)
        o = job["options"]
        result = convert(drawing, Options(o["wallLayers"], o["heightM"], o["thicknessM"], o["mode"], o.get("floor", True)), out, progress)
        _update(job_id, status="done", step="완료", progress=100, result=result, finishedAt=_now())
    except (ConvertError, DxfError) as e:
        _update(job_id, status="failed", error={"code": e.code, "message": e.message}, finishedAt=_now())
    except Exception:
        log.error("job %s crashed:\n%s", job_id, traceback.format_exc())  # 원인은 로그에, 사용자에게는 일반 문장
        _update(job_id, status="failed", error={"code": "internal", "message": "변환 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요."}, finishedAt=_now())


def enqueue(upload_id: str, options: dict) -> str:
    job_id = uuid.uuid4().hex
    storage.write_json(job_path(job_id), {
        "id": job_id, "uploadId": upload_id, "options": options,
        "status": "queued", "step": "접수", "progress": 0, "createdAt": _now(),
    })
    if REDIS_URL:
        from redis import Redis
        from rq import Queue

        Queue("convert", connection=Redis.from_url(REDIS_URL)).enqueue(
            "app.jobs.run", job_id, job_id=job_id, job_timeout=JOB_TIMEOUT_S, result_ttl=3600, failure_ttl=86400)
    else:
        threading.Thread(target=run, args=(job_id,), daemon=True).start()
    return job_id


def public_view(job: dict) -> dict:
    """화면에 필요한 것만 (2장) — 내부 경로·옵션 원문은 내보내지 않는다."""
    view = {k: job.get(k) for k in ("id", "status", "step", "progress", "error", "createdAt", "finishedAt")}
    view["steps"] = STEPS
    if job.get("status") == "done":
        view["metrics"] = job["result"]["metrics"]
        view["files"] = {k: {"url": f"/api/jobs/{job['id']}/files/{k}", "bytes": v["bytes"]} for k, v in job["result"]["files"].items()}
    return view
