// 위험 번호 표시 — 3D(BuildingView)와 위험 목록(BuildingPage)이 같은 모양·같은 번호를 쓴다.
// 바탕은 --color-danger(작은 글자를 올려도 대비 4.5:1 이상), 글자는 bg. 그래픽용 --color-risk는 대비가 모자라 글자 바탕으로 쓰지 않는다.
// 번호 = 위험 목록(층 → 법규 먼저로 정렬, 요소별로 묶음)의 순번. 3D는 받은 findings 순서대로 요소마다 번호를 붙인다.
import type { Finding } from "./rules";

export const RISK_PIN = "grid size-6 shrink-0 place-items-center rounded-full bg-danger text-label font-semibold tabular-nums text-bg";

const KIND_KO: Record<Finding["kind"], string> = { wall: "벽", door: "문", window: "창", stair: "계단", floor: "바닥" };

/** "계단 s1" · "벽 w5" · "바닥" */
export const elementLabel = (f: Pick<Finding, "kind" | "elementId">) => (f.kind === "floor" ? "바닥" : `${KIND_KO[f.kind]} ${f.elementId}`);

/** 목록·3D 공통 순서: 층 → 법규 먼저. 같은 요소는 첫 등장 자리로 묶인다 */
export function sortFindings(fs: Finding[]) {
  return [...fs].sort((a, b) => a.floor - b.floor || (a.level === b.level ? 0 : a.level === "law" ? -1 : 1));
}

/** 요소별 묶음 — 순서가 곧 번호(1부터) */
export function groupFindings(sorted: Finding[]) {
  const m = new Map<string, Finding[]>();
  sorted.forEach((f) => m.set(f.key, [...(m.get(f.key) ?? []), f]));
  return [...m.values()];
}
