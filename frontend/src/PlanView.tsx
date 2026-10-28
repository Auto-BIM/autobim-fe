// 2D 평면 — Plan(중심선 + 두께)을 SVG로 그린다. 벽·문·창을 눌러 고를 수 있다.
//
// 좌표: Plan은 CAD 축(y 위쪽)이고 SVG는 y 아래쪽이라, 도면 묶음을 위아래로 뒤집어 그린다(scale(1,-1)).
// 선 굵기는 확대·축소와 상관없이 같은 픽셀로(vector-effect: non-scaling-stroke).
// 색은 site-theme.css의 역할 이름(--color-wall, --color-door …)만 쓴다.
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Opening, Plan, Wall } from "./api";
import { elementName, findElement, mm, openingCenter, planBounds, wallDir } from "./plan";
import { NEW_PREFIX } from "./draft";
import type { Stair } from "./building";

type Props = {
  plan: Plan; // 고칠 내용이 반영된 미리보기 Plan
  removed: Set<string>; // 지우기로 한 요소(점선으로)
  review: Set<string>; // 확인 필요 요소(노란 점선 테두리)
  selected: string | null;
  onSelect: (id: string | null) => void;
  stairs?: Stair[]; // 사용자가 그린 계단
  risky?: Set<string>; // 위험으로 걸린 요소(빨간 테두리)
  onDrawStair?: (r: { x0: number; y0: number; x1: number; y1: number }) => void; // 있으면 "계단 그리기" 상태 — 끌어서 사각형
};

/** 중심선과 두께로 벽 사각형 네 꼭짓점 */
function wallPoly(w: Wall, from = 0, to = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y), grow = 0) {
  const d = wallDir(w);
  const n = { x: -d.y, y: d.x };
  const t = w.thickness / 2 + grow;
  const a = { x: w.start.x + d.x * from, y: w.start.y + d.y * from };
  const b = { x: w.start.x + d.x * to, y: w.start.y + d.y * to };
  return [
    [a.x + n.x * t, a.y + n.y * t],
    [b.x + n.x * t, b.y + n.y * t],
    [b.x - n.x * t, b.y - n.y * t],
    [a.x - n.x * t, a.y - n.y * t],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

const pressable = (id: string, onSelect: Props["onSelect"]) => ({
  role: "button" as const,
  tabIndex: 0,
  onClick: (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(id);
  },
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  },
});

export function PlanView({ plan, removed, review, selected, onSelect, stairs = [], risky, onDrawStair }: Props) {
  const flip = useRef<SVGGElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // 화면 좌표 → 도면(mm) 좌표: 뒤집힌 묶음의 변환 행렬을 거꾸로
  const toPlan = (e: React.PointerEvent) => {
    const g = flip.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(g.getScreenCTM()!.inverse());
    return { x: Math.round(pt.x / 50) * 50, y: Math.round(pt.y / 50) * 50 }; // 5cm 단위로 맞춤
  };
  const b = useMemo(() => planBounds(plan), [plan]);
  const pad = Math.max(b.w, b.h) * 0.08;
  // 아래·왼쪽에 전체 치수 글자 자리
  const vb = [b.minX - pad * 1.6, -(b.maxY + pad), b.w + pad * 2.6, b.h + pad * 2.6];
  const walls = new Map(plan.walls.map((w) => [w.id, w]));
  const fs = Math.max(b.w, b.h) / 45; // 글자 크기(도면 단위)

  const opening = (o: Opening) => {
    const w = walls.get(o.wall_id);
    if (!w) return null;
    const c = o.position;
    const isNew = o.id.startsWith(NEW_PREFIX);
    const gone = removed.has(o.id);
    const color = o.type === "door" ? "var(--color-door)" : "var(--color-window)";
    const name = elementName(findElement(plan, o.id), o.id);
    const center = openingCenter(o, w);
    return (
      <g key={o.id} {...(isNew ? {} : pressable(o.id, onSelect))} aria-label={isNew ? "추가할 문·창" : name} aria-pressed={selected === o.id} className={isNew ? "" : "cursor-pointer outline-none"}>
        {/* 벽을 개구부 폭만큼 바탕색으로 잘라내고, 그 자리에 문·창 표시 */}
        <polygon points={wallPoly(w, c - o.width / 2, c + o.width / 2, 2)} fill="var(--color-bg)" />
        <polygon
          points={wallPoly(w, c - o.width / 2, c + o.width / 2, -w.thickness * 0.15)}
          fill={o.type === "window" ? "none" : color}
          fillOpacity={gone ? 0 : 0.85}
          stroke={color}
          strokeWidth={o.type === "window" ? 2 : 1}
          strokeDasharray={gone || isNew ? "4 3" : undefined}
          vectorEffect="non-scaling-stroke"
        />
        {o.type === "window" ? <polygon points={wallPoly(w, c - o.width / 2, c + o.width / 2, -w.thickness * 0.42)} fill={color} fillOpacity={gone ? 0 : 0.9} stroke="none" /> : null}
        {/* 누르기 쉽게 보이지 않는 넓은 영역 */}
        <circle cx={center.x} cy={center.y} r={Math.max(o.width / 2, w.thickness * 2)} fill="transparent" />
        {risky?.has(o.id) ? <circle cx={center.x} cy={center.y} r={Math.max(o.width * 0.7, 300)} fill="none" stroke="var(--color-risk)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" /> : null}
        {review.has(o.id) ? <circle cx={center.x} cy={center.y} r={Math.max(o.width * 0.62, 260)} fill="none" stroke="var(--color-review)" strokeWidth={2} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" /> : null}
        {selected === o.id ? <circle cx={center.x} cy={center.y} r={Math.max(o.width * 0.62, 260)} fill="none" stroke="var(--color-accent)" strokeWidth={3} vectorEffect="non-scaling-stroke" /> : null}
      </g>
    );
  };

  return (
    <svg
      viewBox={vb.join(" ")}
      className="block size-full select-none"
      role="group"
      aria-label="평면 — 벽·문·창을 눌러 고르세요"
      onClick={() => !onDrawStair && onSelect(null)}
      onPointerDown={(e) => { if (!onDrawStair) return; const p = toPlan(e); (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
      onPointerMove={(e) => { if (drag) { const p = toPlan(e); setDrag({ ...drag, x1: p.x, y1: p.y }); } }}
      onPointerUp={() => {
        if (drag && onDrawStair && Math.abs(drag.x1 - drag.x0) > 300 && Math.abs(drag.y1 - drag.y0) > 300) onDrawStair(drag);
        setDrag(null);
      }}
      style={onDrawStair ? { cursor: "crosshair", touchAction: "none" } : undefined}
    >
      <g transform="scale(1,-1)" ref={flip}>
        {plan.walls.map((w) => {
          const gone = removed.has(w.id);
          return (
            <g key={w.id} {...pressable(w.id, onSelect)} aria-label={elementName({ kind: "wall", el: w })} aria-pressed={selected === w.id} className="cursor-pointer outline-none [&:focus-visible>polygon:first-child]:stroke-(--color-focus)">
              <polygon
                points={wallPoly(w)}
                fill={gone ? "none" : w.kind === "exterior" ? "var(--color-wall-ext)" : "var(--color-wall)"}
                stroke={gone ? "var(--color-ink-3)" : "var(--color-wall-ext)"}
                strokeWidth={1}
                strokeDasharray={gone ? "4 3" : undefined}
                vectorEffect="non-scaling-stroke"
              />
              {risky?.has(w.id) ? <polygon points={wallPoly(w, 0, undefined, 110)} fill="none" stroke="var(--color-risk)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" /> : null}
              {review.has(w.id) ? <polygon points={wallPoly(w, 0, undefined, 90)} fill="none" stroke="var(--color-review)" strokeWidth={2} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" /> : null}
              {selected === w.id ? <polygon points={wallPoly(w, 0, undefined, 60)} fill="none" stroke="var(--color-accent)" strokeWidth={3} vectorEffect="non-scaling-stroke" /> : null}
            </g>
          );
        })}
        {plan.openings.map(opening)}
        {stairs.map((st) => {
          const X0 = Math.min(st.x0, st.x1), X1 = Math.max(st.x0, st.x1), Y0 = Math.min(st.y0, st.y1), Y1 = Math.max(st.y0, st.y1);
          const alongX = st.dir[0] === "x";
          const lines = Array.from({ length: st.steps - 1 }, (_, k) => {
            const f = (k + 1) / st.steps;
            return alongX ? [X0 + (X1 - X0) * f, Y0, X0 + (X1 - X0) * f, Y1] : [X0, Y0 + (Y1 - Y0) * f, X1, Y0 + (Y1 - Y0) * f];
          });
          // 오르는 방향 화살표
          const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
          const a = { "x+": [X0 + 150, cy, X1 - 150, cy], "x-": [X1 - 150, cy, X0 + 150, cy], "y+": [cx, Y0 + 150, cx, Y1 - 150], "y-": [cx, Y1 - 150, cx, Y0 + 150] }[st.dir];
          const sel = selected === st.id;
          return (
            <g key={st.id} {...pressable(st.id, onSelect)} aria-label={`계단 ${st.id}`} aria-pressed={sel} className="cursor-pointer outline-none">
              <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="var(--color-surface-2)" stroke={risky?.has(st.id) ? "var(--color-risk)" : "var(--color-ink-2)"} strokeWidth={risky?.has(st.id) ? 2.5 : 1} vectorEffect="non-scaling-stroke" />
              {lines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="var(--color-ink-3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
              <line x1={a[0]} y1={a[1]} x2={a[2]} y2={a[3]} stroke="var(--color-ink)" strokeWidth={1.5} markerEnd="url(#stair-arrow)" vectorEffect="non-scaling-stroke" />
              {sel ? <rect x={X0 - 60} y={Y0 - 60} width={X1 - X0 + 120} height={Y1 - Y0 + 120} fill="none" stroke="var(--color-accent)" strokeWidth={3} vectorEffect="non-scaling-stroke" /> : null}
            </g>
          );
        })}
        {drag ? (
          <rect x={Math.min(drag.x0, drag.x1)} y={Math.min(drag.y0, drag.y1)} width={Math.abs(drag.x1 - drag.x0)} height={Math.abs(drag.y1 - drag.y0)}
            fill="var(--color-accent)" fillOpacity={0.12} stroke="var(--color-accent)" strokeDasharray="5 3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ) : null}
      </g>
      <defs>
        <marker id="stair-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-ink)" />
        </marker>
      </defs>

      {/* 전체 치수 (아래: 가로, 왼쪽: 세로) */}
      <g fill="var(--color-ink-3)" stroke="var(--color-ink-3)" fontSize={fs} fontFamily="var(--font-sans)">
        <line x1={b.minX} x2={b.maxX} y1={-b.minY + pad * 0.9} y2={-b.minY + pad * 0.9} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <text x={(b.minX + b.maxX) / 2} y={-b.minY + pad * 0.9 + fs * 1.4} textAnchor="middle" stroke="none">{mm(b.w)}</text>
        <line x1={b.minX - pad * 0.9} x2={b.minX - pad * 0.9} y1={-b.maxY} y2={-b.minY} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <text x={b.minX - pad * 0.9 - fs * 0.6} y={-(b.minY + b.maxY) / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${b.minX - pad * 0.9 - fs * 0.6} ${-(b.minY + b.maxY) / 2})`}>{mm(b.h)}</text>
      </g>
    </svg>
  );
}
