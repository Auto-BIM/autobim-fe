"""DXF 읽기 — 선분 목록과 레이어 정보를 뽑는다. 분석(미리보기)과 변환이 같은 함수를 쓴다(10장: 한 곳에)."""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import ezdxf
from ezdxf import recover
from ezdxf import bbox
from ezdxf.path import make_path

from .config import MAX_DXF_ENTITIES

# $INSUNITS 코드 → 미터 배율 (ezdxf 문서의 단위 표)
UNIT_TO_M = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0, 14: 0.1}
UNIT_NAME = {1: "inch", 2: "feet", 4: "mm", 5: "cm", 6: "m", 14: "dm"}

# 벽 레이어로 추천할 이름 조각 (대소문자 무시)
WALL_HINTS = ("WALL", "벽", "WAL", "A-WALL", "A_WALL", "ARCH-WALL")


class DxfError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


@dataclass
class Drawing:
    segments: list[tuple[str, float, float, float, float]]  # (레이어, x1, y1, x2, y2) — 도면 단위
    unit_code: int
    unit_guessed: bool
    scale_to_m: float
    layer_order: list[str] = field(default_factory=list)


CURVES = ("LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE", "ELLIPSE", "SPLINE")


def _collect(entity, layer_override, out, tol, depth=0, counter=None):
    if counter is not None:
        counter[0] += 1
        if counter[0] > MAX_DXF_ENTITIES:
            raise DxfError("too_many_entities", f"도면 요소가 너무 많아요({MAX_DXF_ENTITIES:,}개 초과). 필요한 층만 남겨 올려 주세요.")
    t = entity.dxftype()
    layer = entity.dxf.get("layer", "0")
    if layer == "0" and layer_override:
        layer = layer_override  # 블록 안 "0" 레이어 요소는 삽입한 쪽 레이어를 따른다(CAD 관례)
    if t == "LINE":
        s, e = entity.dxf.start, entity.dxf.end
        out.append((layer, s.x, s.y, e.x, e.y))
    elif t in CURVES:
        try:
            pts = [(v.x, v.y) for v in make_path(entity).flattening(tol, segments=8)]
        except Exception:
            return  # 읽을 수 없는 곡선 하나는 건너뛴다
        for a, b in zip(pts, pts[1:]):
            if a != b:
                out.append((layer, a[0], a[1], b[0], b[1]))
    elif t == "INSERT" and depth < 8:
        try:
            for sub in entity.virtual_entities():
                _collect(sub, layer, out, tol, depth + 1, counter)
        except Exception:
            pass  # 깨진 블록 하나 때문에 전체를 실패시키지 않는다


def read_drawing(path: Path) -> Drawing:
    try:
        doc, auditor = recover.readfile(str(path))
    except (IOError, ezdxf.DXFStructureError) as e:
        raise DxfError("bad_dxf", "DXF를 읽을 수 없어요. CAD에서 다시 저장(R2013 이상 권장)해 올려 주세요.") from e

    msp = doc.modelspace()
    # 곡선을 선분으로 나눌 허용 오차: 도면 크기의 1/2000 (단위와 상관없이 비슷한 정밀도)
    try:
        ext = bbox.extents(msp, fast=True)
        span = max(ext.size.x, ext.size.y) if ext.has_data else 0
        tol = span / 2000 if 0 < span < 1e12 else 0.01
    except Exception:
        tol = 0.01
    segs: list[tuple[str, float, float, float, float]] = []
    counter = [0]
    for e in msp:
        _collect(e, None, segs, tol, 0, counter)
    if not segs:
        raise DxfError("empty_dxf", "도면에서 선을 찾지 못했어요. 평면도가 모델 공간에 그려져 있는지 확인해 주세요.")

    unit = int(doc.header.get("$INSUNITS", 0) or 0)
    guessed = unit not in UNIT_TO_M
    if guessed:
        # 단위가 없으면 크기로 짐작: 평면도 한 변이 1,000 이상이면 mm, 100 이상이면 cm, 아니면 m
        xs = [v for s in segs for v in (s[1], s[3])]
        ys = [v for s in segs for v in (s[2], s[4])]
        span = max(max(xs) - min(xs), max(ys) - min(ys))
        unit = 4 if span > 1000 else 5 if span > 100 else 6
    order = []
    for s in segs:
        if s[0] not in order:
            order.append(s[0])
    return Drawing(segs, unit, guessed, UNIT_TO_M[unit], order)


def summarize(d: Drawing, preview_max: int) -> dict:
    count = defaultdict(int)
    length = defaultdict(float)
    for layer, x1, y1, x2, y2 in d.segments:
        count[layer] += 1
        length[layer] += math.hypot(x2 - x1, y2 - y1)
    xs = [v for s in d.segments for v in (s[1], s[3])]
    ys = [v for s in d.segments for v in (s[2], s[4])]
    idx = {name: i for i, name in enumerate(d.layer_order)}
    step = max(1, math.ceil(len(d.segments) / preview_max))
    preview = [[idx[s[0]], round(s[1], 3), round(s[2], 3), round(s[3], 3), round(s[4], 3)] for s in d.segments[::step]]
    layers = [
        {
            "name": name,
            "count": count[name],
            "lengthM": round(length[name] * d.scale_to_m, 2),
            "suggestedWall": any(h in name.upper() for h in WALL_HINTS),
        }
        for name in d.layer_order
    ]
    return {
        "unit": UNIT_NAME[d.unit_code],
        "unitGuessed": d.unit_guessed,
        "scaleToM": d.scale_to_m,
        "bbox": [min(xs), min(ys), max(xs), max(ys)],
        "sizeM": [round((max(xs) - min(xs)) * d.scale_to_m, 2), round((max(ys) - min(ys)) * d.scale_to_m, 2)],
        "layers": layers,
        "preview": {"segments": preview, "truncated": step > 1, "total": len(d.segments)},
    }
