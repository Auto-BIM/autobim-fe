"""도면3D API.

  POST /api/uploads              도면 올리기 → 검사 → 저장 → (DXF면) 레이어 분석
  POST /api/jobs                 고른 벽 레이어로 변환 작업 접수
  GET  /api/jobs/{id}            작업 상태 (화면이 1초마다 확인)
  GET  /api/jobs/{id}/files/{k}  결과 파일 glb·obj·stl
  GET  /api/sample.dxf           시험용 도면
"""
from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from . import jobs, storage
from .config import ALLOWED_ORIGINS, MAX_UPLOAD_BYTES, PREVIEW_MAX_SEGMENTS, UPLOADS_PER_HOUR_PER_IP
from .dxf_reader import DxfError, read_drawing, summarize
from .validate import UploadError, sniff

app = FastAPI(title="도면3D API", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
SAMPLES = Path(__file__).resolve().parent.parent / "samples"


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    resp.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
    if request.url.path.startswith("/api/") and "Cache-Control" not in resp.headers:
        resp.headers["Cache-Control"] = "private, no-store"  # 작업마다 다른 응답 — 공용 캐시 금지
    return resp


@app.exception_handler(UploadError)
async def upload_error(_req, e: UploadError):
    return JSONResponse({"error": {"code": e.code, "message": e.message}}, status_code=e.status)


# 아주 단순한 IP별 속도 제한(무차별 업로드 방지). 여러 서버로 늘리면 Redis로 옮긴다.
_hits: dict[str, deque] = defaultdict(deque)


def _rate_limit(ip: str):
    now, q = time.time(), _hits[ip]
    while q and now - q[0] > 3600:
        q.popleft()
    if len(q) >= UPLOADS_PER_HOUR_PER_IP:
        raise UploadError("rate_limited", "잠시 뒤 다시 올려 주세요. 한 시간에 올릴 수 있는 횟수를 넘었어요.", 429)
    q.append(now)


async def _read_limited(file: UploadFile) -> bytes:
    data = bytearray()
    while chunk := await file.read(1024 * 1024):
        data += chunk
        if len(data) > MAX_UPLOAD_BYTES:
            raise UploadError("too_large", f"파일이 너무 커요. {MAX_UPLOAD_BYTES // 1024 // 1024}MB 이하로 올려 주세요.", 413)
    if not data:
        raise UploadError("empty_file", "빈 파일이에요.")
    return bytes(data)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/uploads")
async def create_upload(request: Request, file: UploadFile = File(...)):
    _rate_limit(request.client.host if request.client else "?")
    data = await _read_limited(file)
    s = sniff(data)
    upload_id = uuid.uuid4().hex  # 저장 이름은 우리가 만든다 — 사용자가 준 파일 이름은 경로에 쓰지 않는다
    src = storage.path("uploads", upload_id, f"source.{s.ext}")
    storage.write_bytes(src, s.data)

    if s.kind == "image":
        # 이미지 → 선 찾기는 2단계 작업. 지금은 받아 두고 안내만 한다.
        return {"uploadId": upload_id, "kind": "image", "analysis": None,
                "notice": "이미지 평면도 변환은 준비 중이에요. 지금은 DXF로 올려 주세요."}
    try:
        analysis = summarize(read_drawing(src), PREVIEW_MAX_SEGMENTS)
    except DxfError as e:
        raise UploadError(e.code, e.message, 422) from e
    storage.write_json(storage.path("uploads", upload_id, "analysis.json"), analysis)
    return {"uploadId": upload_id, "kind": "dxf", "fileName": (file.filename or "")[:120], "analysis": analysis}


class JobIn(BaseModel):
    uploadId: str = Field(pattern=r"^[0-9a-f]{32}$")
    wallLayers: list[str] = Field(min_length=1, max_length=50)
    heightM: float = Field(2.4, ge=1.0, le=20.0)
    thicknessM: float = Field(0.2, ge=0.02, le=1.0)
    mode: str = Field("auto", pattern=r"^(auto|outline|centerline)$")
    floor: bool = True


@app.post("/api/jobs", status_code=202)
def create_job(body: JobIn):
    analysis = storage.read_json(storage.path("uploads", body.uploadId, "analysis.json"))
    if not analysis:
        raise HTTPException(404, "올린 도면을 찾을 수 없어요. 다시 올려 주세요.")
    known = {l["name"] for l in analysis["layers"]}
    unknown = [l for l in body.wallLayers if l not in known]
    if unknown:
        raise HTTPException(422, f"도면에 없는 레이어예요: {', '.join(unknown[:3])}")
    job_id = jobs.enqueue(body.uploadId, body.model_dump(exclude={"uploadId"}))
    return {"jobId": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    try:
        job = jobs.get(job_id)
    except ValueError:
        job = None
    if not job:
        raise HTTPException(404, "작업을 찾을 수 없어요. 보관 기간(7일)이 지났을 수 있어요.")
    return jobs.public_view(job)


MEDIA = {"glb": ("model/gltf-binary", "model.glb"), "obj": ("text/plain", "model.obj"), "stl": ("model/stl", "model.stl")}


@app.get("/api/jobs/{job_id}/files/{kind}")
def get_file(job_id: str, kind: str, download: bool = False):
    if kind not in MEDIA:
        raise HTTPException(404)
    try:
        job = jobs.get(job_id)
    except ValueError:
        job = None
    if not job or job.get("status") != "done":
        raise HTTPException(404, "결과 파일이 아직 없어요.")
    media, name = MEDIA[kind]
    p = storage.path("results", job_id, name)
    headers = {"Cache-Control": "private, max-age=3600"}  # 같은 작업의 결과는 바뀌지 않는다
    return FileResponse(p, media_type=media, filename=f"floorplan-3d.{kind}" if download else None, headers=headers,
                        content_disposition_type="attachment" if download else "inline")


@app.get("/api/sample.dxf")
def sample():
    return FileResponse(SAMPLES / "sample-plan.dxf", media_type="application/dxf", filename="sample-plan.dxf",
                        headers={"Cache-Control": "public, max-age=86400"})
