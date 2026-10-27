"""업로드 검사 — 확장자가 아니라 파일 내용으로 형식을 판단한다 (AGENTS.md 15장)."""
from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image

from .config import MAX_IMAGE_SIDE


class UploadError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


@dataclass
class Sniffed:
    kind: str  # "dxf" | "image"
    ext: str  # 저장할 확장자 (우리가 정한다)
    data: bytes  # 저장할 바이트 (이미지는 위치 정보 등을 지운 사본)


def sniff(data: bytes) -> Sniffed:
    head = data[:4096]
    if head.startswith(b"AutoCAD Binary DXF"):
        return Sniffed("dxf", "dxf", data)
    if head[:4] in (b"AC10", b"AC1.") or head.startswith(b"AC10"):
        raise UploadError("dwg_not_supported", "DWG 파일이에요. CAD에서 DXF로 저장한 뒤 올려 주세요.", 415)
    text = head.decode("latin-1", errors="ignore").upper()
    if "SECTION" in text and ("HEADER" in text or "ENTITIES" in text or "TABLES" in text or "CLASSES" in text):
        return Sniffed("dxf", "dxf", data)
    if head.startswith(b"\x89PNG\r\n\x1a\n") or head.startswith(b"\xff\xd8\xff"):
        return Sniffed("image", "png", _clean_image(data))
    raise UploadError("unsupported_type", "DXF 또는 PNG·JPG 평면도만 올릴 수 있어요.", 415)


def _clean_image(data: bytes) -> bytes:
    """이미지는 픽셀만 다시 저장한다 — 위치 정보(EXIF GPS)·메타데이터를 남기지 않는다."""
    try:
        with Image.open(io.BytesIO(data)) as im:
            im.verify()
        with Image.open(io.BytesIO(data)) as im:
            if max(im.size) > MAX_IMAGE_SIDE:
                raise UploadError("image_too_large", f"이미지의 긴 변이 {MAX_IMAGE_SIDE}px를 넘어요. 줄여서 올려 주세요.", 413)
            clean = Image.new(im.mode if im.mode in ("RGB", "RGBA", "L") else "RGB", im.size)
            clean.paste(im.convert(clean.mode))
            out = io.BytesIO()
            clean.save(out, format="PNG", optimize=True)
            return out.getvalue()
    except UploadError:
        raise
    except Exception as e:  # 깨진 이미지
        raise UploadError("bad_image", "이미지를 읽을 수 없어요. 다른 파일로 시도해 주세요.") from e
