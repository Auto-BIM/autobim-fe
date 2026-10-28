// 샘플 3층 건물 — 첫 화면과 "샘플 건물 보기"에 쓴다. 서버 없이 보이도록 Plan 모양으로 직접 적어 둔다.
// 원본: 사용자가 준 autobim-hero / autobim-defect 애니메이션의 평면 데이터(팀 자체 제작).
// 2층에는 일부러 문제를 넣었다(얇은 벽, 가파른 계단) — 위험 검토 시연용.
import type { Opening, Plan, Wall } from "./api";
import type { FloorModel } from "./building";

type Op = [center: number, width: number, type: "w" | "d"];
type W = [x0: number, z0: number, x1: number, z1: number, ops: Op[], thick?: number];

const Wm = 16;
const Dm = 11;
const WALL_H = 2700;

function toPlan(name: string, ext: W[], int: W[]): Plan {
  const walls: Wall[] = [];
  const openings: Opening[] = [];
  let wi = 0;
  let oi = 0;
  const add = (w: W, kind: "exterior" | "interior") => {
    const id = `w${++wi}`;
    // 애니메이션 좌표(m, z 아래쪽) → Plan(mm, y 위쪽): y = −z
    walls.push({
      id, kind, height: WALL_H, confidence: 1,
      thickness: (w[5] ?? (kind === "exterior" ? 0.22 : 0.12)) * 1000,
      start: { x: w[0] * 1000, y: -w[1] * 1000 },
      end: { x: w[2] * 1000, y: -w[3] * 1000 },
    });
    for (const [c, width, t] of w[4])
      openings.push({
        id: `o${++oi}`, wall_id: id, confidence: 1, position: c * 1000, width: width * 1000,
        type: t === "w" ? "window" : "door",
        height: t === "w" ? 1200 : 2100,
        sill_height: t === "w" ? 900 : 0,
      });
  };
  ext.forEach((w) => add(w, "exterior"));
  int.forEach((w) => add(w, "interior"));
  return {
    schema_version: "1.0", units: "mm",
    source: { type: "image", filename: `${name}.png`, width_px: null, height_px: null },
    scale: { source: "user", estimated: false, mm_per_px: null },
    walls, openings, review_items: [],
  };
}

const F1 = toPlan(
  "1F",
  [[0, 0, Wm, 0, [[3, 1.6, "w"], [8, 1.2, "d"], [12.5, 2.4, "w"]]], [Wm, 0, Wm, Dm, [[3, 1.4, "w"]]],
   [Wm, Dm, 0, Dm, [[5, 2.4, "w"], [9, 1.4, "w"]]], [0, Dm, 0, 0, [[5.5, 1.6, "w"]]]],
  [[6, 0, 6, Dm, [[7, 0.9, "d"]]], [6, 6, Wm, 6, [[3, 0.9, "d"], [7.5, 0.9, "d"]]], [11, 6, 11, Dm, []], [0, 4, 6, 4, [[3, 0.9, "d"]]]],
);
const F2 = toPlan(
  "2F",
  [[0, 0, Wm, 0, [[2.5, 1.6, "w"], [8, 1.6, "w"], [13.5, 1.6, "w"]]], [Wm, 0, Wm, Dm, [[3, 1.4, "w"]]],
   [Wm, Dm, 0, Dm, [[3, 1.6, "w"], [8, 1.6, "w"]]], [0, Dm, 0, 0, [[3, 1.4, "w"], [8, 1.4, "w"]]]],
  [[5, 0, 5, Dm, [[8, 0.9, "d"]]], [5, 5.5, Wm, 5.5, [[2, 0.9, "d"], [7, 0.9, "d"]]], [10.5, 0, 10.5, 5.5, []], [12, 5.5, 12, Dm, [[2.5, 0.9, "d"]], 0.06]],
);
const F3 = toPlan(
  "3F",
  [[0, 0, Wm, 0, [[4, 3, "w"], [12, 3, "w"]]], [Wm, 0, Wm, Dm, [[5.5, 2.4, "w"]]],
   [Wm, Dm, 0, Dm, [[4, 3, "w"], [12, 3, "w"]]], [0, Dm, 0, 0, [[5.5, 2, "w"]]]],
  [[8, 3, 8, Dm, [[3, 0.9, "d"]]], [0, 7, 8, 7, [[4, 0.9, "d"]]]],
);

const FH = WALL_H + 200;

export const SAMPLE_FLOORS: FloorModel[] = [
  { index: 0, jobId: "", name: "1F", note: "현관 · 거실", heightMm: FH, plan: F1,
    stairs: [{ id: "s1", x0: 11400, x1: 15600, y0: -7150, y1: -6250, steps: 15, dir: "x+" }] },
  { index: 1, jobId: "", name: "2F", note: "침실 3", heightMm: FH, plan: F2,
    stairs: [{ id: "s1", x0: 12300, x1: 15700, y0: -6950, y1: -5700, steps: 13, dir: "x+" }] },
  { index: 2, jobId: "", name: "3F", note: "오픈 스튜디오", heightMm: FH, plan: F3, stairs: [] },
];
