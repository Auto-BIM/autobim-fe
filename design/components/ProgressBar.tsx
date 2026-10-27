/**
 * ProgressBar — 오래 걸리는 작업의 진행. 퍼센트 막대 + 지금 단계 문장.
 * 0.3초 안에 끝나는 일에는 쓰지 않는다. 막대는 줄어들지 않는다(뒤로 가지 않게 보여준다).
 */
import { cx } from "./cx";

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 flex items-baseline justify-between text-body-sm">
          <span className="text-ink">{label}</span>
          <span className="tabular-nums text-ink-3">{v}%</span>
        </div>
      ) : null}
      <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1.5 overflow-hidden bg-surface-2 rounded-chip">
        <div className={cx("h-full bg-primary transition-[width] duration-300 ease-standard")} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
