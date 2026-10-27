/**
 * Stepper — 여러 단계 폼(가입·예약·결제)의 위치 표시. 단계는 3~5개.
 *   데스크톱: 번호 + 이름을 한 줄로
 *   모바일  : "2 / 3 · 결제 정보" 한 줄 + 얇은 진행 막대
 * 지난 단계는 체크, 현재 단계만 진하게, 다음 단계는 흐리게.
 */
import { cx } from "./cx";
import { IconCheck } from "./icons";

export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <nav aria-label="진행 단계" className={className}>
      {/* 모바일 */}
      <div className="sm:hidden">
        <p className="text-body-sm text-ink-2">
          <span className="font-semibold text-ink">
            {current + 1} / {steps.length}
          </span>
          <span className="mx-1.5 text-ink-3">·</span>
          {steps[current]}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2 calm:rounded-none">
          <div className="h-full bg-primary transition-[width] duration-300 ease-standard" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {/* 데스크톱 */}
      <ol className="hidden items-center gap-3 sm:flex">
        {steps.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={s} className="flex items-center gap-3" aria-current={now ? "step" : undefined}>
              <span
                className={cx(
                  "grid size-7 shrink-0 place-items-center rounded-full text-label font-semibold calm:rounded-none",
                  done && "bg-ink text-bg",
                  now && "bg-primary text-primary-ink",
                  !done && !now && "bg-surface-2 text-ink-3",
                )}
              >
                {done ? <IconCheck size={14} strokeWidth={2.5} /> : i + 1}
                <span className="sr-only">{done ? "완료" : now ? "현재 단계" : "남은 단계"}</span>
              </span>
              <span className={cx("text-body-sm", now ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink-3")}>
                {s}
              </span>
              {i < steps.length - 1 ? <span aria-hidden className="h-px w-8 bg-line-strong lg:w-12" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
