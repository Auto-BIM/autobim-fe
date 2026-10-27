"""파일 저장소 — 지금은 디스크 폴더. 클라우드에서 API와 작업 처리기가 다른 기계면
이 모듈만 오브젝트 스토리지(S3·GCS)로 바꾼다. 다른 코드는 경로를 직접 만들지 않는다.

  uploads/<uploadId>/source.<ext>     올린 원본 (비공개)
  uploads/<uploadId>/analysis.json    분석 결과
  jobs/<jobId>.json                   작업 상태
  results/<jobId>/model.{glb,obj,stl} 결과 파일
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

from .config import STORAGE_DIR

_ID = re.compile(r"^[0-9a-f]{32}$")


def check_id(value: str) -> str:
    """경로에 들어가는 ID는 우리가 만든 32자리 16진수만 허용 — 사용자 입력이 경로를 바꾸지 못하게."""
    if not _ID.match(value or ""):
        raise ValueError("bad id")
    return value


def path(*parts: str) -> Path:
    p = STORAGE_DIR.joinpath(*parts).resolve()
    if STORAGE_DIR not in p.parents and p != STORAGE_DIR:
        raise ValueError("path escapes storage")
    return p


def write_bytes(rel: Path, data: bytes) -> None:
    rel.parent.mkdir(parents=True, exist_ok=True)
    rel.write_bytes(data)


def write_json(rel: Path, obj: dict) -> None:
    """원자적으로 쓴다(반쯤 쓰인 파일을 다른 프로세스가 읽지 않게)."""
    rel.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=rel.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, rel)


def read_json(rel: Path) -> dict | None:
    try:
        return json.loads(rel.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
