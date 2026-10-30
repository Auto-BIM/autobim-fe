/**
 * PanelSection — 옆 패널(고치기·정보) 안의 한 묶음. 번호(작은 라벨) + 제목 + 오른쪽 메타, 위쪽 1px 선으로 나눈다.
 *   01  실제 크기                          추정 ●
 *   ─────────────────────────────────────────
 *   내용
 *
 * 규칙 (patterns C형 도구형)
 * - 패널 안은 상자(테두리 카드·점선 상자)로 나누지 않는다. 묶음마다 이 부품 하나.
 * - 첫 묶음의 위 선은 진하게(ink), 나머지는 옅게(line) — 패널이 어디서 시작하는지 보인다.
 * - tone="review": 사용자가 확인해야 하는 묶음이면 위 선을 확인 필요 색으로(사이트가 --color-review를 정했을 때).
 * - 번호는 2자리(01, 02…). 묶음이 2개 이하면 번호를 빼도 된다(n 생략).
 */
import type { ReactNode } from "react";
import { cx } from "./cx";

export function PanelSection({
  n,
  title,
  meta,
  tone,
  children,
  className,
}: {
  n?: string;
  title: ReactNode;
  meta?: ReactNode;
  tone?: "review";
  children: ReactNode;
  className?: string;
}) {
  const id = `panel-${typeof title === "string" ? title : n ?? "x"}`.replace(/\s+/g, "-");
  return (
    <section
      aria-labelledby={id}
      className={cx("border-t py-5", tone === "review" ? "border-(--color-review)" : "border-line first:border-ink", className)}
    >
      <header className="mb-3 flex items-baseline gap-3">
        {n ? <span className="micro-label tabular-nums text-ink-3">{n}</span> : null}
        <h2 id={id} className="text-body font-semibold">{title}</h2>
        {meta ? <span className="ml-auto text-label text-ink-3">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}
