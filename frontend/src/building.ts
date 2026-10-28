// 건물 = 층 여러 개. 층마다 도면을 따로 올리고(작업 ID 하나씩), 층 순서·층고·계단·용도는 사용자가 넣는다.
//
// 왜 프론트에서 묶나: 백엔드는 "도면 한 장 = 한 층"만 인식한다(층·계단 정보 없음, 계약 docs/api.md).
// 그래서 층 쌓기·계단·용도는 프론트가 들고 있고, 주소(#b=…)에 넣어 새로 고침·공유에도 남게 한다.
// 계단은 아직 인식되지 않으므로 사용자가 평면에서 직접 그린다(계획서: 불확실한 것은 사용자가 보충).
import type { Plan, Space, SpaceType } from "./api";

export type UseKey = "apartment" | "house" | "neighborhood" | "other";

export const USE_LABEL: Record<UseKey, string> = {
  apartment: "공동주택(아파트)",
  house: "단독주택",
  neighborhood: "근린생활시설",
  other: "기타",
};

/** 계단: 평면(mm) 위 사각형 + 단 수 + 올라가는 방향. 다음 층 바닥까지 오른다. */
export type Stair = {
  id: string; // s1, s2…
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  steps: number;
  dir: "x+" | "x-" | "y+" | "y-"; // 올라가는 쪽
};

export type FloorRef = {
  jobId: string;
  name: string; // "1F"
  heightMm: number; // 층고(바닥 위 ~ 다음 층 바닥 위)
  note?: string; // "거실 · 현관" 같은 짧은 메모
  stairs: Stair[];
};

export type Building = { use: UseKey; floors: FloorRef[] };

/** 그릴 준비가 된 층 (Plan이 붙음) */
export type FloorModel = FloorRef & { plan: Plan; index: number };

export const SLAB_MM = 200;
export const defaultFloorHeight = (p: Plan) => Math.max(2400, ...p.walls.map((w) => w.height)) + SLAB_MM;

// ─── 주소에 담기 (#b=…) — 짧게: JSON → base64url ──────────────────────────

export function encodeBuilding(b: Building) {
  const json = JSON.stringify(b);
  const bytes = new TextEncoder().encode(json);
  let s = "";
  bytes.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBuilding(code: string): Building | null {
  try {
    const s = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
    const b = JSON.parse(json) as Building;
    // 주소는 누구나 고칠 수 있으므로 모양을 확인한다
    if (!b || !Array.isArray(b.floors) || !(b.use in USE_LABEL)) return null;
    const ok = b.floors.every((f) => /^[0-9a-f]{32}$/.test(f.jobId) && Number.isFinite(f.heightMm) && f.heightMm > 1000 && f.heightMm < 20000 && Array.isArray(f.stairs));
    return ok ? b : null;
  } catch {
    return null;
  }
}

export const buildingFromHash = () => {
  const m = location.hash.match(/^#b=([A-Za-z0-9_-]+)$/);
  return m ? decodeBuilding(m[1]) : null;
};
export const buildingHash = (b: Building) => `#b=${encodeBuilding(b)}`;

// ─── 계단 계산 ───────────────────────────────────────────────────────────

/** 계단 폭(오르는 방향에 직각) · 길이(오르는 방향) mm */
export function stairDims(s: Stair) {
  const dx = Math.abs(s.x1 - s.x0);
  const dy = Math.abs(s.y1 - s.y0);
  const alongX = s.dir === "x+" || s.dir === "x-";
  return { width: alongX ? dy : dx, run: alongX ? dx : dy };
}
export function stairRiseTread(s: Stair, floorHeightMm: number) {
  const { run } = stairDims(s);
  // 3D와 같은 방식: 길이를 단 수로 나눈 값을 단너비로 본다(마지막 단 = 위층 바닥)
  return { riser: floorHeightMm / s.steps, tread: run / s.steps };
}

// ─── 공간(실) — AI Hub 공간 12종 ─────────────────────────────────────────

export const SPACE_LABEL: Record<SpaceType, string> = {
  living: "거실", bedroom: "침실", kitchen: "주방", entrance: "현관", balcony: "발코니", bathroom: "화장실",
  outdoor_unit: "실외기룸", dressroom: "드레스룸", multipurpose: "다목적공간", elevator_hall: "엘리베이터홀", stair: "계단실", elevator: "엘리베이터",
};

export function polygonArea(p: { x: number; y: number }[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q.x * r.y - r.x * q.y; }
  return Math.abs(a) / 2;
}

/**
 * 층에서 실제로 쓸 계단: 사용자가 그린 계단이 있으면 그것, 없으면 인식된 "계단실" 공간에서 자동으로 만든 후보.
 * 계단실은 "어디에 계단이 있는지"만 알려 준다(단 수·방향은 모름) → 긴 쪽으로 오르고, 기준 단높이를 넘지 않는 단 수로 둔 뒤
 * 사용자에게 확인을 받는다(계획서: 불확실한 것은 임의로 확정하지 않고 보충 요청).
 */
export function effectiveStairs(f: FloorRef & { plan: Plan }, maxRiser = 180): (Stair & { auto?: boolean })[] {
  if (f.stairs.length) return f.stairs;
  return (f.plan.spaces ?? [])
    .filter((s: Space) => s.type === "stair" && s.polygon.length >= 3)
    .map((s, i) => {
      const xs = s.polygon.map((p) => p.x), ys = s.polygon.map((p) => p.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const alongX = x1 - x0 >= y1 - y0;
      // 계단실 안쪽에 계단 한 줄(폭은 짧은 쪽 절반 — 나머지는 계단참·되돌아 오르는 쪽)
      const half = alongX ? (y1 - y0) / 2 : (x1 - x0) / 2;
      return {
        id: `a${i + 1}`, auto: true,
        x0, x1: alongX ? x1 : x0 + half, y0, y1: alongX ? y0 + half : y1,
        steps: Math.max(3, Math.ceil(f.heightMm / maxRiser)), dir: alongX ? ("x+" as const) : ("y+" as const),
      };
    });
}

export const nextStairId = (f: FloorRef) => `s${Math.max(0, ...f.stairs.map((s) => Number(s.id.slice(1)) || 0)) + 1}`;
