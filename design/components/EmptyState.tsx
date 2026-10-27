/**
 * EmptyState — 결과 없음 · 아직 비어 있음 · 불러오기 실패. 막다른 길로 두지 않는다.
 *
 * 반드시 세 가지: ① 무슨 상황인지(검색어를 그대로 다시 보여준다) ② 왜일 수 있는지/대안 ③ 다음 행동 하나
 *   no-results : "‘치과’에 맞는 결과가 없어요" + 대안 칩(철자 확인·필터 해제·인기 검색어) + [필터 모두 해제]
 *   empty      : "아직 담은 작품이 없어요" + 무엇을 하면 채워지는지 + [둘러보기]
 *   error      : "불러오지 못했어요" + 내 탓이 아님을 알림 + [다시 시도]
 * 그림은 작게(48px) 하나만. 큰 일러스트·캐릭터는 쓰지 않는다.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";
import { IconAlert, IconNoResult } from "./icons";

export function EmptyState({
  kind = "no-results",
  query,
  title,
  description,
  suggestions,
  action,
  className,
}: {
  kind?: "no-results" | "empty" | "error";
  query?: string;
  title?: ReactNode;
  description?: ReactNode;
  /** 대안 — 보통 Chip 또는 링크 목록 */
  suggestions?: ReactNode;
  /** 다음 행동 — Button 하나 */
  action?: ReactNode;
  className?: string;
}) {
  const heading =
    title ??
    (kind === "no-results" && query ? (
      <>
        <span className="text-ink">‘{query}’</span>에 맞는 결과가 없어요
      </>
    ) : kind === "error" ? (
      "불러오지 못했어요"
    ) : (
      "아직 비어 있어요"
    ));

  return (
    <section
      aria-live="polite"
      className={cx("mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center", className)}
    >
      <span className="mb-5 grid size-12 place-items-center rounded-full bg-surface-2 text-ink-3 calm:rounded-none">
        {kind === "error" ? <IconAlert size={24} /> : <IconNoResult size={24} />}
      </span>
      <h2 className="text-title-sm font-bold text-ink-2 calm:font-display calm:font-semibold">{heading}</h2>
      {description ? <p className="mt-2 text-body-sm text-ink-3">{description}</p> : null}
      {suggestions ? <div className="mt-6 flex flex-wrap justify-center gap-2">{suggestions}</div> : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </section>
  );
}
