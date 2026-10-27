"""설정 — 모두 환경 변수로. 비밀 값은 없다(로그인·외부 API 없음)."""
import os
from pathlib import Path

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "./data")).resolve()
REDIS_URL = os.getenv("REDIS_URL", "")  # 비어 있으면 API 프로세스 안에서 작업을 돌린다(로컬 개발용)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "20")) * 1024 * 1024
MAX_DXF_ENTITIES = int(os.getenv("MAX_DXF_ENTITIES", "200000"))
MAX_IMAGE_SIDE = int(os.getenv("MAX_IMAGE_SIDE", "8000"))
JOB_TIMEOUT_S = int(os.getenv("JOB_TIMEOUT_S", "120"))
RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "7"))
UPLOADS_PER_HOUR_PER_IP = int(os.getenv("UPLOADS_PER_HOUR_PER_IP", "30"))
PREVIEW_MAX_SEGMENTS = 20000
