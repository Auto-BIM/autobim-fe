// Plan(중간 표현) 계산 도우미 — 화면(2D·3D·속성 패널)이 같은 계산을 한 곳에서 쓴다.
// 단위 mm, CAD 축(y 위쪽). 3D(glTF)로 갈 때: m 단위, Plan (x, y) → (x, 높이, −y)
import type { Opening, Plan, ReviewItem, ReviewReason, Wall, WallKind, OpeningType } from "./api";

export const wallLength = (w: Wall) => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);

/** 벽 방향 단위 벡터 */
export const wallDir = (w: Wall) => {
  const L = wallLength(w) || 1;
  return { x: (w.end.x - w.start.x) / L, y: (w.end.y - w.start.y) / L };
};

/** 개구부 중심점 (벽 시작점에서 중심선을 따라 position만큼) */
export function openingCenter(o: Opening, w: Wall) {
  const d = wallDir(w);
  return { x: w.start.x + d.x * o.position, y: w.start.y + d.y * o.position };
}

/** 도면 전체 범위(벽 두께 포함) */
export function planBounds(p: Plan) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of p.walls) {
    const t = w.thickness / 2;
    for (const q of [w.start, w.end]) {
      minX = Math.min(minX, q.x - t);
      minY = Math.min(minY, q.y - t);
      maxX = Math.max(maxX, q.x + t);
      maxY = Math.max(maxY, q.y + t);
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000, w: 1000, h: 1000 };
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** 건물 가로 길이 = 가장 바깥 벽 중심선 사이의 x 길이 (백엔드 building_width_mm와 같은 정의) */
export function buildingWidthMm(p: Plan) {
  const xs = p.walls.flatMap((w) => [w.start.x, w.end.x]);
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
}

export type Element = { kind: "wall"; el: Wall } | { kind: "opening"; el: Opening };

export function findElement(p: Plan, id: string): Element | null {
  const w = p.walls.find((x) => x.id === id);
  if (w) return { kind: "wall", el: w };
  const o = p.openings.find((x) => x.id === id);
  return o ? { kind: "opening", el: o } : null;
}

/** 요소별 확인 필요 항목 */
export function reviewsById(p: Plan) {
  const m = new Map<string, ReviewItem[]>();
  for (const r of p.review_items) m.set(r.element_id, [...(m.get(r.element_id) ?? []), r]);
  return m;
}

// ─── 화면에 쓰는 말 ──────────────────────────────────────────────────────

export const KIND_LABEL: Record<WallKind, string> = { exterior: "외벽", interior: "내벽", unknown: "미상" };
export const OPENING_LABEL: Record<OpeningType, string> = { door: "문", window: "창" };

export const REASON_LABEL: Record<ReviewReason, string> = {
  low_confidence: "인식이 확실하지 않아요",
  scale_estimated: "실제 크기를 추정했어요",
  default_value_applied: "기본값을 썼어요",
  unattached_opening: "붙은 벽을 찾지 못했어요",
  dimension_conflict: "치수가 서로 맞지 않아요",
  other: "확인이 필요해요",
};

export const SCALE_LABEL: Record<Plan["scale"]["source"], string> = {
  dimension: "도면의 치수로 맞춤",
  building_width: "건물 가로 길이로 맞춤",
  assumed_wall_thickness: "외벽 두께 200mm로 추정",
  user: "직접 넣은 기준으로 맞춤",
  source_units: "DXF 단위로 맞춤",
};

/** "외벽 w1", "문 o3" */
export function elementName(e: Element | null, id?: string) {
  if (!e) return id === "plan" ? "도면 전체" : (id ?? "");
  return e.kind === "wall" ? `${KIND_LABEL[e.el.kind]} ${e.el.id}` : `${OPENING_LABEL[e.el.type]} ${e.el.id}`;
}

export const mm = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}`;
export const m2 = (v: number) => (v / 1000).toFixed(2);
export const pct = (v: number | null) => (v == null ? "직접 추가" : `${Math.round(v * 100)}%`);

// 기본값 (autobim-be docs/ASSUMPTIONS.md) — 속성 패널에서 "기본값 900" 같은 안내에 쓴다
export const DEFAULTS = {
  exterior_wall_thickness: 200,
  interior_wall_thickness: 120,
  wall_height: 2400,
  door: { width: 900, height: 2100, sill_height: 0 },
  window: { width: 1200, height: 1200, sill_height: 900 },
} as const;
