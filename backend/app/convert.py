"""평면도 → 3D. 고른 벽 레이어의 선으로 벽 단면(2D 다각형)을 만들고 높이만큼 세운다.

벽을 그리는 방식은 도면마다 다르다:
  outline    벽 양쪽 면을 두 줄로 그린 도면(가장 흔함) → 선으로 둘러싸인 "얇은" 면만 벽으로 본다
  centerline 벽 중심선 한 줄만 그린 도면                → 선을 벽 두께만큼 두껍게 한다
  auto       얇은 면이 선 길이의 절반 이상을 설명하면 outline, 아니면 centerline
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass

import numpy as np
import shapely
import trimesh
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import polygonize, unary_union

from .dxf_reader import Drawing

MAX_WALL_THICKNESS_M = 0.6  # 이보다 두꺼운 닫힌 면은 방(바닥)으로 본다


class ConvertError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


@dataclass
class Options:
    wall_layers: list[str]
    height_m: float = 2.4
    thickness_m: float = 0.2  # centerline 모드에서만
    mode: str = "auto"
    floor: bool = True


def _as_polys(geom) -> list[Polygon]:
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]


def wall_footprint(d: Drawing, opt: Options, progress=lambda step, pct: None) -> tuple[list[Polygon], str, float]:
    """벽 단면 다각형(미터 단위), 실제로 쓴 모드, 고른 선의 총 길이(m)."""
    s = d.scale_to_m
    chosen = [seg for seg in d.segments if seg[0] in set(opt.wall_layers)]
    if not chosen:
        raise ConvertError("no_wall_lines", "고른 레이어에 선이 없어요. 벽이 그려진 레이어를 골라 주세요.")
    # 미터로 바꾸고 1mm 격자에 맞춰 끝점을 붙인다(살짝 떨어진 선을 이어 주기)
    lines = [LineString([(round(x1 * s, 3), round(y1 * s, 3)), (round(x2 * s, 3), round(y2 * s, 3))]) for _, x1, y1, x2, y2 in chosen]
    lines = [ln for ln in lines if ln.length > 1e-6]
    total_len = sum(ln.length for ln in lines)
    progress("선 정리", 20)
    merged = unary_union(lines)  # 교차점에서 선을 나눈다(면 찾기 준비)

    mode = opt.mode
    thin: list[Polygon] = []
    if mode in ("auto", "outline"):
        progress("벽 면 찾기", 35)
        faces = list(polygonize(merged))
        for f in faces:
            if f.area <= 0:
                continue
            width = 2 * f.area / f.length  # 면의 평균 두께
            if width <= MAX_WALL_THICKNESS_M:
                thin.append(f)
        if mode == "auto":
            covered = sum(f.length for f in thin) / 2  # 얇은 면 둘레의 절반 ≈ 그 면이 설명하는 벽 길이
            mode = "outline" if thin and covered >= 0.5 * total_len * 0.5 else "centerline"
            # (두 줄 벽이면 선 총길이의 약 절반이 벽 길이다 → 0.5 × 0.5)

    if mode == "outline":
        if not thin:
            raise ConvertError("no_closed_walls", "벽 면을 찾지 못했어요. 벽 선이 닫혀 있지 않을 수 있어요. '중심선' 방식으로 다시 시도해 보세요.")
        polys = _as_polys(unary_union(thin))
    else:
        progress("중심선을 벽 두께로", 35)
        r = max(0.02, opt.thickness_m) / 2
        polys = _as_polys(unary_union([ln.buffer(r, cap_style="flat", join_style="mitre") for ln in lines]).buffer(0))
        # 끝이 맞닿는 모서리를 메운다
        polys = _as_polys(unary_union(polys).buffer(r * 0.999, join_style="mitre").buffer(-r * 0.999, join_style="mitre"))

    polys = [p for p in polys if p.area > 1e-4]
    if not polys:
        raise ConvertError("no_walls", "벽을 만들 수 없었어요. 다른 레이어나 방식을 골라 보세요.")
    return polys, mode, total_len


def build_mesh(polys: list[Polygon], opt: Options, progress=lambda step, pct: None) -> tuple[trimesh.Scene, dict]:
    progress("벽 세우기", 60)
    parts = []
    for p in polys:
        p = shapely.make_valid(p).buffer(0)
        for q in _as_polys(p):
            parts.append(trimesh.creation.extrude_polygon(q, opt.height_m))
    walls = trimesh.util.concatenate(parts)

    footprint = unary_union(polys)
    # 바닥 = 건물 바깥 테두리 안쪽. 문·창 개구부(최대 3m)로 끊긴 벽을 잠시 메워 테두리를 찾는다
    closed = footprint.buffer(1.5, join_style="mitre").buffer(-1.5, join_style="mitre")
    outer = unary_union([Polygon(q.exterior) for q in _as_polys(closed)])
    floor_area = outer.area

    minx, miny, maxx, maxy = footprint.bounds
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2

    scene = trimesh.Scene()
    walls.apply_translation([-cx, -cy, 0])
    walls.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        name="wall", baseColorFactor=[236, 234, 229, 255], roughnessFactor=0.9, metallicFactor=0.0))
    scene.add_geometry(walls, node_name="walls", geom_name="walls")
    tris = len(walls.faces)
    if opt.floor:
        floors = []
        for q in _as_polys(outer):
            f = trimesh.creation.extrude_polygon(q, 0.05)
            f.apply_translation([-cx, -cy, -0.05])
            floors.append(f)
        fl = trimesh.util.concatenate(floors)
        fl.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
            name="floor", baseColorFactor=[205, 201, 193, 255], roughnessFactor=1.0, metallicFactor=0.0))
        scene.add_geometry(fl, node_name="floor", geom_name="floor")
        tris += len(fl.faces)

    metrics = {
        "wallPieces": len(polys),
        "wallAreaM2": round(footprint.area, 2),
        "floorAreaM2": round(floor_area, 2),
        "widthM": round(maxx - minx, 2),
        "depthM": round(maxy - miny, 2),
        "heightM": opt.height_m,
        "triangles": int(tris),
    }
    return scene, metrics


def export(scene: trimesh.Scene, out_dir, progress=lambda step, pct: None) -> dict:
    """GLB·OBJ는 Y가 위(three.js·대부분의 3D 프로그램), STL은 Z가 위(3D 프린팅 관례)."""
    progress("파일 만들기", 85)
    out_dir.mkdir(parents=True, exist_ok=True)
    z_up_to_y_up = trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0])
    y_up = scene.copy()
    y_up.apply_transform(z_up_to_y_up)
    files = {}
    (out_dir / "model.glb").write_bytes(y_up.export(file_type="glb"))
    files["glb"] = "model.glb"
    (out_dir / "model.obj").write_text(y_up.to_mesh().export(file_type="obj"), encoding="utf-8")
    files["obj"] = "model.obj"
    (out_dir / "model.stl").write_bytes(scene.to_mesh().export(file_type="stl"))
    files["stl"] = "model.stl"
    return {k: {"name": v, "bytes": (out_dir / v).stat().st_size} for k, v in files.items()}


def convert(d: Drawing, opt: Options, out_dir, progress=lambda step, pct: None) -> dict:
    t0 = time.perf_counter()
    if not (1.0 <= opt.height_m <= 20.0):
        raise ConvertError("bad_height", "벽 높이는 1~20m 사이로 정해 주세요.")
    if not (0.02 <= opt.thickness_m <= 1.0):
        raise ConvertError("bad_thickness", "벽 두께는 0.02~1m 사이로 정해 주세요.")
    polys, mode, total_len = wall_footprint(d, opt, progress)
    scene, metrics = build_mesh(polys, opt, progress)
    files = export(scene, out_dir, progress)
    metrics.update({"mode": mode, "lineLengthM": round(total_len, 2), "seconds": round(time.perf_counter() - t0, 2)})
    return {"metrics": metrics, "files": files}
