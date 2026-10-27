"""시험용 평면도 DXF를 만든다 (직접 설계한 가상의 집 — 실제 도면을 옮기지 않음).

벽은 실제 CAD 도면처럼 '양쪽 면을 그린 닫힌 선'(A-WALL), 문은 열림 호(A-DOOR),
창은 세 줄(A-WIND), 가구(A-FURN), 글자(A-ANNO)가 다른 레이어에 있다. 단위는 mm.
    python -m app.sample  → samples/sample-plan.dxf, samples/sample-plan-centerline.dxf
"""
from __future__ import annotations

from pathlib import Path

import ezdxf
from shapely.geometry import LineString, box
from shapely.ops import unary_union

EXT_T, INT_T = 200, 120
# 중심선 (x1, y1, x2, y2, 두께)
WALLS = [
    (0, 0, 10000, 0, EXT_T), (10000, 0, 10000, 8000, EXT_T), (10000, 8000, 0, 8000, EXT_T), (0, 8000, 0, 0, EXT_T),
    (4000, 0, 4000, 8000, INT_T), (4000, 4500, 10000, 4500, INT_T), (0, 3000, 4000, 3000, INT_T),
]
# 벽을 뚫는 개구부 (x1, y1, x2, y2) — 문 900, 창 1500~2500
DOORS = [(3900, 5500, 4100, 6400), (6000, 4400, 6900, 4600), (1500, 2900, 2400, 3100), (7000, -150, 8000, 150)]
WINDOWS = [(1000, 7850, 3000, 8150), (6000, 7850, 8500, 8150), (-150, 4000, 150, 6000), (9850, 1200, 10150, 3200)]
FURNITURE = [(500, 5000, 2500, 7200), (6500, 5600, 8600, 7300), (4800, 800, 6400, 1800)]
LABELS = [("거실", 7000, 2400), ("침실", 1600, 4600), ("욕실", 1600, 1400), ("방", 7000, 6200)]


def wall_body():
    body = unary_union([LineString([(a, b), (c, d)]).buffer(t / 2, cap_style="square", join_style="mitre") for a, b, c, d, t in WALLS])
    for x1, y1, x2, y2 in DOORS + WINDOWS:
        body = body.difference(box(x1, y1, x2, y2))
    return body


def _new():
    doc = ezdxf.new("R2013", setup=True)
    doc.header["$INSUNITS"] = 4  # mm
    for name, color in [("A-WALL", 7), ("A-DOOR", 3), ("A-WIND", 5), ("A-FURN", 8), ("A-ANNO", 2)]:
        doc.layers.add(name, color=color)
    return doc


def _common(msp):
    for x1, y1, x2, y2 in DOORS:  # 문짝(선) + 열림 호
        horiz = (x2 - x1) > (y2 - y1)
        if horiz:
            msp.add_line((x1, y1), (x1, y1 + 900), dxfattribs={"layer": "A-DOOR"})
            msp.add_arc((x1, y1), 900, 0, 90, dxfattribs={"layer": "A-DOOR"})
        else:
            msp.add_line((x1, y1), (x1 + 900, y1), dxfattribs={"layer": "A-DOOR"})
            msp.add_arc((x1, y1), 900, 0, 90, dxfattribs={"layer": "A-DOOR"})
    for x1, y1, x2, y2 in WINDOWS:  # 창은 세 줄
        if (x2 - x1) > (y2 - y1):
            for y in (y1 + 50, (y1 + y2) / 2, y2 - 50):
                msp.add_line((x1, y), (x2, y), dxfattribs={"layer": "A-WIND"})
        else:
            for x in (x1 + 50, (x1 + x2) / 2, x2 - 50):
                msp.add_line((x, y1), (x, y2), dxfattribs={"layer": "A-WIND"})
    for x1, y1, x2, y2 in FURNITURE:
        msp.add_lwpolyline([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], close=True, dxfattribs={"layer": "A-FURN"})
    for text, x, y in LABELS:
        msp.add_text(text, height=250, dxfattribs={"layer": "A-ANNO", "insert": (x, y)})


def outline_dxf(path: Path):
    doc = _new()
    msp = doc.modelspace()
    body = wall_body()
    polys = list(body.geoms) if hasattr(body, "geoms") else [body]
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            msp.add_lwpolyline(list(ring.coords), close=True, dxfattribs={"layer": "A-WALL"})
    _common(msp)
    doc.saveas(path)


def centerline_dxf(path: Path):
    doc = _new()
    msp = doc.modelspace()
    for a, b, c, d, _t in WALLS:  # 개구부를 뺀 중심선
        line = LineString([(a, b), (c, d)])
        for x1, y1, x2, y2 in DOORS + WINDOWS:
            line = line.difference(box(x1, y1, x2, y2))
        for part in getattr(line, "geoms", [line]):
            if part.length > 0:
                msp.add_line(*part.coords, dxfattribs={"layer": "A-WALL-CL"})
    _common(msp)
    doc.saveas(path)


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "samples"
    out.mkdir(exist_ok=True)
    outline_dxf(out / "sample-plan.dxf")
    centerline_dxf(out / "sample-plan-centerline.dxf")
    print("written", *sorted(p.name for p in out.iterdir()))
