// 위험 검토 규칙 — 건물 용도에 따라 기준 수치가 바뀐다.
//
// 두 종류를 구분해서 보여 준다
//   law    = 법령에 수치가 있는 것 (조항을 함께 표시)
//   common = 법령 수치는 아니지만 실무에서 통상 쓰는 기준 (근거 설명을 함께 표시)
// ⚠ 참고용 검토다. 법률 자문이 아니며, 최신 법령 원문(국가법령정보센터)으로 다시 확인해야 한다.
//   수치 출처: 주택건설기준 등에 관한 규정 제16조, 건축물의 피난·방화구조 등의 기준에 관한 규칙 제15조·제16조
//   (2차 자료로 확인, 2026-10-28). 규칙은 2026-10-06에 일부 개정되었으므로 원문 대조가 필요하다.
import type { Opening, Wall } from "./api";
import { SLAB_MM, stairDims, stairRiseTread, type FloorModel, type Stair, type UseKey } from "./building";
import { planBounds } from "./plan";

export type Level = "law" | "common";
export type Finding = {
  key: string; // `${층 번호}:${요소 ID}` — 3D·목록에서 같은 요소를 가리킨다
  floor: number;
  elementId: string; // w3 · o2 · s1 · floor
  kind: "wall" | "door" | "window" | "stair" | "floor";
  level: Level;
  title: string; // "계단 폭 부족"
  measured: string; // "0.9 m"
  standard: string; // "1.2 m 이상"
  why: string; // 왜 위험한지 — 커서를 올리면 보여 준다
  basis: string; // 근거
};

type StairStd = { width: number; riser: number; tread: number; landingEvery: number; level: Level; basis: string };

/** 용도별 계단 기준 (mm) */
export const STAIR_STD: Record<UseKey, StairStd> = {
  apartment: { width: 1200, riser: 180, tread: 260, landingEvery: 2000, level: "law", basis: "주택건설기준 등에 관한 규정 제16조 (공동주택 공용 계단)" },
  house: { width: 750, riser: 200, tread: 240, landingEvery: 3000, level: "common", basis: "통상 기준 — 공동주택 세대 내 계단 수치(주택건설기준 제16조)를 단독주택에 준용" },
  neighborhood: { width: 600, riser: 200, tread: 240, landingEvery: 3000, level: "law", basis: "피난·방화구조 규칙 제15조 (기타 계단 너비 60cm 이상, 계단참 3m마다) · 단높이·단너비는 통상 기준" },
  other: { width: 600, riser: 200, tread: 240, landingEvery: 3000, level: "law", basis: "피난·방화구조 규칙 제15조 (기타 계단) · 단높이·단너비는 통상 기준" },
};

const m = (mm: number) => `${(mm / 1000).toFixed(2)} m`;
const cm = (mm: number) => `${Math.round(mm / 10)} cm`;
const mmTxt = (v: number) => `${Math.round(v)} mm`;

export function review(floors: FloorModel[], use: UseKey): Finding[] {
  const out: Finding[] = [];
  const std = STAIR_STD[use];

  floors.forEach((f, fi) => {
    const p = f.plan;
    const walls = new Map(p.walls.map((w) => [w.id, w]));

    // ── 계단 ──
    f.stairs.forEach((s: Stair) => {
      const { width } = stairDims(s);
      const { riser, tread } = stairRiseTread(s, f.heightMm);
      const k = { key: `${fi}:${s.id}`, floor: fi, elementId: s.id, kind: "stair" as const };
      // 근린생활시설: 바로 위층 거실 바닥면적 200㎡ 이상이면 계단 너비 120cm (규칙 제15조) — 위층 바닥 면적은 도면 외곽으로 어림
      let needW = std.width;
      if (use === "neighborhood" && floors[fi + 1]) {
        const b = planBounds(floors[fi + 1].plan);
        if ((b.w * b.h) / 1e6 >= 200) needW = 1200;
      }
      if (width < needW)
        out.push({ ...k, level: std.level, title: "계단 폭 부족", measured: m(width), standard: `${m(needW)} 이상`, basis: std.basis,
          why: "폭이 좁으면 위급할 때 여러 사람이 동시에 피난하기 어렵고, 마주 지나가다 넘어질 수 있어요." });
      if (riser > std.riser)
        out.push({ ...k, level: use === "apartment" ? "law" : "common", title: "계단 단높이 초과", measured: mmTxt(riser), standard: `${mmTxt(std.riser)} 이하`, basis: std.basis,
          why: `한 단이 높으면 오르내릴 때 발이 걸리거나 헛디뎌 넘어지기 쉬워요. 층고 ${m(f.heightMm)}를 ${s.steps}단으로 나눈 값이에요 — 단 수를 늘리면 줄어요.` });
      if (tread < std.tread)
        out.push({ ...k, level: use === "apartment" ? "law" : "common", title: "계단 단너비 부족", measured: mmTxt(tread), standard: `${mmTxt(std.tread)} 이상`, basis: std.basis,
          why: "디딤판이 좁으면 발이 다 올라가지 않아 내려갈 때 미끄러지기 쉬워요. 계단 길이를 늘려야 해요." });
      if (f.heightMm > std.landingEvery)
        out.push({ ...k, level: "law", title: "계단참 필요", measured: `한 번에 ${m(f.heightMm)}`, standard: `${m(std.landingEvery)} 이내마다 계단참`,
          basis: use === "apartment" ? "주택건설기준 등에 관한 규정 제16조" : "피난·방화구조 규칙 제15조",
          why: "쉬는 곳 없이 길게 이어진 계단은 떨어졌을 때 끝까지 굴러 크게 다칠 수 있어요. 중간에 평평한 계단참을 두어야 해요." });
    });

    // ── 반자높이 (거실 천장 높이) ──
    const minH = Math.min(...p.walls.map((w) => w.height), f.heightMm - SLAB_MM);
    if (p.walls.length && minH < 2100)
      out.push({ key: `${fi}:floor`, floor: fi, elementId: "floor", kind: "floor", level: "law", title: "천장 높이 부족",
        measured: m(minH), standard: "2.10 m 이상", basis: "피난·방화구조 규칙 제16조 (거실의 반자높이)",
        why: "천장이 낮으면 답답할 뿐 아니라 연기가 빨리 내려와 피난할 시간이 줄어요." });

    // ── 창: 2층 이상 바깥 창의 창대가 낮으면 추락 위험 ──
    if (fi >= 1)
      p.openings.filter((o) => o.type === "window").forEach((o: Opening) => {
        const w = walls.get(o.wall_id);
        if (w?.kind === "exterior" && o.sill_height < 900)
          out.push({ key: `${fi}:${o.id}`, floor: fi, elementId: o.id, kind: "window", level: "common", title: "창 추락 위험",
            measured: `창대 ${m(o.sill_height)}`, standard: "0.90 m 이상 또는 추락방지 난간",
            basis: "통상 기준 — 2층 이상 바깥 창은 창대를 높이거나 난간을 둔다(주택건설기준 제18조 난간 규정 참고)",
            why: "창 아래가 낮으면 아이가 기대거나 올라섰다가 밖으로 떨어질 수 있어요." });
      });

    // ── 문 ──
    p.openings.filter((o) => o.type === "door").forEach((o) => {
      const w = walls.get(o.wall_id);
      const entrance = w?.kind === "exterior";
      const need = entrance ? 900 : 750;
      if (o.width < need)
        out.push({ key: `${fi}:${o.id}`, floor: fi, elementId: o.id, kind: "door", level: "common", title: entrance ? "출입문 폭 부족" : "문 폭 좁음",
          measured: cm(o.width), standard: `${cm(need)} 이상`, basis: "통상 기준 — 실내문 75cm, 출입문 90cm",
          why: entrance ? "출입문이 좁으면 피난할 때 병목이 생기고 들것·휠체어가 지나가기 어려워요." : "문이 좁으면 휠체어·보행 보조기가 지나가기 어렵고 가구도 들이기 힘들어요." });
    });

    // ── 벽 두께 ──
    p.walls.forEach((w: Wall) => {
      const need = w.kind === "exterior" ? 150 : 90;
      if (w.thickness < need)
        out.push({ key: `${fi}:${w.id}`, floor: fi, elementId: w.id, kind: "wall", level: "common",
          title: w.kind === "exterior" ? "외벽 두께 부족" : "벽 두께 부족", measured: mmTxt(w.thickness), standard: `${mmTxt(need)} 이상`,
          basis: "통상 기준 — 외벽 150mm·내벽 90mm (구조·단열·차음 검토 필요)",
          why: w.kind === "exterior" ? "외벽이 얇으면 구조적으로 약하고 단열·결로 문제가 생기기 쉬워요." : "벽이 얇으면 소리가 그대로 넘어가고, 선반·설비를 고정하기 어려워요." });
    });
  });
  return out;
}

export const LEVEL_LABEL: Record<Level, string> = { law: "법규", common: "통상 기준" };
