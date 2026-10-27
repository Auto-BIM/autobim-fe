"""첫 화면용 샘플 모델 만들기 — 우리가 직접 만든 샘플 도면(app/sample.py)만 쓴다.

    python -m app.hero_sample            # → ../frontend/public/sample/plan.glb, plan.json

plan.json에는 변환 결과 수치와 벽이 아닌 선(문·창·가구)을 three.js 좌표(미터, Y 위)로 담는다.
첫 화면은 서버 없이도 보여야 하므로 정적 파일로 만든다(요청마다 변환하지 않기 — 풀스택 6장).
"""
import json
import tempfile
from pathlib import Path

from shapely.ops import unary_union

from . import sample
from .convert import Options, convert, wall_footprint
from .dxf_reader import read_drawing

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "sample"
WALL = "A-WALL"
KEEP = {"A-DOOR": "door", "A-WIND": "window", "A-FURN": "furniture"}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        dxf = Path(tmp) / "sample-plan.dxf"
        sample.outline_dxf(dxf)
        d = read_drawing(dxf)
        opt = Options(wall_layers=[WALL])
        res = convert(d, opt, Path(tmp) / "out")
        (OUT / "plan.glb").write_bytes((Path(tmp) / "out" / "model.glb").read_bytes())

        polys, _, _ = wall_footprint(d, opt)
        minx, miny, maxx, maxy = unary_union(polys).bounds
        cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
        s = d.scale_to_m
        lines: dict[str, list[float]] = {v: [] for v in KEEP.values()}
        for layer, x1, y1, x2, y2 in d.segments:
            kind = KEEP.get(layer)
            if not kind:
                continue
            # 도면 (x, y) → three.js (X, Z): 가운데 맞추고, Y 위로 돌릴 때 y는 -Z가 된다 (convert.export와 같은 변환)
            lines[kind] += [round(x1 * s - cx, 3), round(-(y1 * s - cy), 3), round(x2 * s - cx, 3), round(-(y2 * s - cy), 3)]

    m = res["metrics"]
    data = {
        "name": "샘플 평면도",
        "metrics": {k: m[k] for k in ("widthM", "depthM", "floorAreaM2", "heightM", "mode", "wallPieces")},
        "lines": lines,
    }
    (OUT / "plan.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("만듦:", OUT / "plan.glb", (OUT / "plan.glb").stat().st_size, "bytes /", sum(len(v) // 4 for v in lines.values()), "선")


if __name__ == "__main__":
    main()
