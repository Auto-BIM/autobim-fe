/**
 * PressQuote — 평가·인용 한 개 (v0.2). 매체·사람 이름(라벨) → 인용(세리프) → 별점(선택).
 *   2차 부품 평가(2026-10-30): "별점이 인용 아래로" — 인용이 1등, 별점은 뒷받침
 *
 * 규칙
 * - **실제로 있는 평가만, 출처와 함께.** 지어낸 리뷰·후기·별점을 넣지 않는다 (시안에서도 "예시"라고 보이게 표시).
 *   인용은 원문 그대로 짧게(한 문장). 출처 링크가 있으면 href로.
 * - 한 화면에 최대 2개. 3개 이상 나열하면 광고처럼 보인다.
 * - 별점은 0.5 단위, 숫자로도 읽히게(aria-label).
 * 임의 값: 인용 폭 22ch — 대문자·세리프 인용이 2~3줄로 균형 있게 끊기는 폭.
 */
import { cx } from "./cx";
import { IconStar } from "./icons";

export function PressQuote({
  quote,
  source,
  rating,
  href,
  sample,
  className,
}: {
  quote: string;
  source: string;
  /** 0~5, 0.5 단위 */
  rating?: number;
  href?: string;
  /** 시안용 예시 인용이면 true → "예시" 표시가 붙는다 */
  sample?: boolean;
  className?: string;
}) {
  const stars = rating == null ? null : [0, 1, 2, 3, 4].map((i) => (rating >= i + 1 ? 1 : rating >= i + 0.5 ? 0.5 : 0) as 0 | 0.5 | 1);
  const Source = href ? "a" : "span";
  return (
    <figure className={cx("flex flex-col items-center gap-2 text-center", className)}>
      <figcaption className="micro-label text-ink-2">
        <Source {...(href ? { href, target: "_blank", rel: "noreferrer" } : {})} className={href ? "underline-offset-4 hover:underline" : undefined}>
          {source}
        </Source>
        {sample ? <span className="ml-2 text-ink-3">· 예시</span> : null}
      </figcaption>
      <blockquote className="max-w-[22ch] font-display text-title leading-tight tracking-title text-ink">“{quote}”</blockquote>
      {stars ? (
        <div role="img" aria-label={`5점 만점에 ${rating}점`} className="mt-1 flex gap-0.5 text-ink">
          {stars.map((f, i) => (
            <IconStar key={i} amount={f} />
          ))}
        </div>
      ) : null}
    </figure>
  );
}
