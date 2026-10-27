// 2D 미리보기 — 레이어별로 path 하나씩 그린다(선 2만 개도 가볍게). 고른 벽 레이어만 강조색.
import { useMemo } from "react";
import type { Analysis } from "./api";

export function Plan2D({ analysis, selected }: { analysis: Analysis; selected: Set<string> }) {
  const { bbox, preview, layers, sizeM } = analysis;
  const [minx, miny, maxx, maxy] = bbox;
  const w = maxx - minx || 1;
  const h = maxy - miny || 1;
  const pad = Math.max(w, h) * 0.06;

  const paths = useMemo(() => {
    const byLayer = new Map<number, string[]>();
    for (const [li, x1, y1, x2, y2] of preview.segments) {
      const arr = byLayer.get(li) ?? [];
      // DXF는 Y가 위로 증가 → 화면 좌표로 뒤집는다
      arr.push(`M${(x1 - minx).toFixed(1)} ${(maxy - y1).toFixed(1)}L${(x2 - minx).toFixed(1)} ${(maxy - y2).toFixed(1)}`);
      byLayer.set(li, arr);
    }
    return [...byLayer.entries()].map(([li, parts]) => ({ name: layers[li]?.name ?? "", d: parts.join("") }));
  }, [preview, layers, minx, maxy]);

  const sel = paths.filter((p) => selected.has(p.name));
  const rest = paths.filter((p) => !selected.has(p.name));

  return (
    <figure className="m-0">
      <div className="relative bg-surface-2">
        <svg
          viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
          className="block aspect-4/3 w-full"
          role="img"
          aria-label={`평면도 미리보기 — 가로 ${sizeM[0]}m, 세로 ${sizeM[1]}m`}
        >
          {rest.map((p) => (
            <path key={p.name} d={p.d} fill="none" stroke="var(--color-ink-3)" strokeOpacity={0.55} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {sel.map((p) => (
            <path key={p.name} d={p.d} fill="none" stroke="var(--color-accent)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-label tabular-nums text-ink-2">가로 {sizeM[0]} m</span>
        <span className="absolute top-1/2 right-2 -translate-y-1/2 text-label tabular-nums text-ink-2 [writing-mode:vertical-rl]">세로 {sizeM[1]} m</span>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-label text-ink-3">
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-0.5 w-5 bg-accent" />벽으로 고른 선</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-px w-5 bg-ink-3 opacity-60" />다른 선</span>
        {preview.truncated ? <span>미리보기는 선 {preview.segments.length.toLocaleString("ko-KR")}개만 그렸어요 (전체 {preview.total.toLocaleString("ko-KR")}개)</span> : null}
      </figcaption>
    </figure>
  );
}
