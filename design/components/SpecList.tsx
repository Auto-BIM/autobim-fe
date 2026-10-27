/**
 * SpecList — 라벨-값 표. 상세 정보·결과 수치를 줄마다 얇은 선으로 나눠 보여준다.
 *   라벨: 작은 대문자·넓은 자간(eyebrow) 왼쪽 / 값: 오른쪽 정렬, 숫자는 자리 맞춤(tabular)
 * 값이 여러 줄이면 값만 줄을 바꾼다. 단위는 값 쪽에 작게.
 * (취향 프로필 R19의 원리 — 원본 화면을 옮기지 않음)
 */
import type { ReactNode } from "react";
import { cx } from "./cx";

export type Spec = { label: string; value: ReactNode; unit?: string; note?: ReactNode };

export function SpecList({ items, className, dense = false }: { items: Spec[]; className?: string; dense?: boolean }) {
  return (
    <dl className={cx("border-t border-line", className)}>
      {items.map((it) => (
        <div key={it.label} className={cx("flex items-baseline justify-between gap-6 border-b border-line", dense ? "py-2" : "py-3")}>
          <dt className="eyebrow shrink-0">{it.label}</dt>
          <dd className="min-w-0 text-right">
            <span className="text-body tabular-nums text-ink">{it.value}</span>
            {it.unit ? <span className="ml-1 text-label text-ink-3">{it.unit}</span> : null}
            {it.note ? <span className="block text-label text-ink-3">{it.note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
