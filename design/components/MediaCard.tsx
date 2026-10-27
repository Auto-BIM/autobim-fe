"use client";
/**
 * MediaCard — 목록의 기본 단위. 정보 순서는 고정이고, 가장 중요한 하나가 가장 크다.
 *
 *   ┌──────────────┐
 *   │    이미지    │  ← 같은 목록 안에서는 비율·바탕이 모두 같다
 *   └──────────────┘
 *   분류(eyebrow)      ← 선택. 작게
 *   제목 (2줄까지)     ← 넘치면 말줄임
 *   한 줄 메타 / 가격  ← browse=메타 한 줄, compare=가격이 가장 크게
 *
 * variant
 *   browse  : 둘러보는 목록. 이미지 + 제목 + 한 줄. 글자 층 3개 이하
 *   compare : 비교하는 목록. 가격을 가장 크고 굵게, 할인율만 강조색
 * status="soldout" : 이미지 흐리게 + "품절" 배지. 목록에서 빼지 않는다 (위치가 바뀌면 헷갈림)
 *
 * 이미지는 사이트 소유 또는 사용권이 있는 것만. 없으면 ImagePlaceholder를 둔다.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Badge } from "./Chip";

export type Ratio = "1/1" | "4/5" | "3/4" | "2/3" | "3/2" | "16/9";

const ratioClass: Record<Ratio, string> = {
  "1/1": "aspect-square",
  "4/5": "aspect-4/5",
  "3/4": "aspect-3/4",
  "2/3": "aspect-2/3",
  "3/2": "aspect-3/2",
  "16/9": "aspect-video",
};

/** 이미지 자리 — 실제 이미지가 정해지기 전까지 쓴다. 외부 사이트 이미지를 임시로 넣지 않는다. */
export function ImagePlaceholder({ ratio = "4/5", label, className }: { ratio?: Ratio; label?: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label ?? "이미지 자리"}
      className={cx(
        ratioClass[ratio],
        "relative w-full overflow-hidden bg-surface-2",
        "bg-[linear-gradient(135deg,transparent_49.6%,var(--color-line)_50%,transparent_50.4%)]",
        className,
      )}
    >
      {label ? (
        <span className="absolute bottom-2 left-2 text-caption text-ink-3">{label}</span>
      ) : null}
    </div>
  );
}

export type MediaCardProps = {
  href?: string;
  media?: ReactNode; // <img> 또는 next/image. 없으면 자리 표시
  ratio?: Ratio;
  eyebrow?: string;
  title: string;
  meta?: string;
  price?: number;
  priceOriginal?: number;
  status?: "soldout";
  badge?: string;
  variant?: "browse" | "compare";
  /** friendly에서만: 카드에 바탕·그림자를 준다 (대시보드·추천 묶음) */
  framed?: boolean;
  onClick?: () => void;
};

const won = (n: number) => n.toLocaleString("ko-KR");

export function MediaCard({
  href,
  media,
  ratio = "4/5",
  eyebrow,
  title,
  meta,
  price,
  priceOriginal,
  status,
  badge,
  variant = "browse",
  framed = false,
  onClick,
}: MediaCardProps) {
  const soldout = status === "soldout";
  const discount =
    price !== undefined && priceOriginal && priceOriginal > price
      ? Math.round((1 - price / priceOriginal) * 100)
      : null;

  const Body = (
    <>
      <div className={cx("relative overflow-hidden rounded-media", ratioClass[ratio])}>
        <div
          className={cx(
            "size-full transition-[transform,opacity] duration-300 ease-standard",
            "group-hover/card:scale-103",
            soldout && "opacity-45",
          )}
        >
          {media ?? <ImagePlaceholder ratio={ratio} />}
        </div>
        {soldout || badge ? (
          <span className="absolute top-2.5 left-2.5">
            <Badge tone={soldout ? "inverse" : "neutral"}>{soldout ? "품절" : badge}</Badge>
          </span>
        ) : null}
      </div>

      <div className={cx("pt-3", framed && "friendly:px-1 friendly:pb-1")}>
        {eyebrow ? <p className="mb-1 text-label text-ink-3 calm:eyebrow">{eyebrow}</p> : null}
        <h3
          className={cx(
            "line-clamp-2 text-body-sm text-ink",
            variant === "browse" && "text-body font-semibold calm:font-display calm:font-medium",
            "calm:group-hover/card:underline calm:underline-offset-4",
            soldout && "text-ink-3",
          )}
        >
          {onClick && !href ? (
            // 창으로 여는 카드: 제목 버튼을 카드 전체로 늘린다 (버튼 안에 제목·문단을 넣지 않기 위해)
            <button type="button" onClick={onClick} className="text-left after:absolute after:inset-0 after:content-['']">
              {title}
            </button>
          ) : (
            title
          )}
        </h3>
        {variant === "compare" && price !== undefined ? (
          <p className="mt-1.5 flex items-baseline gap-1.5">
            {/* friendly: 가격이 가장 크고 굵게 / calm: 이름과 같은 크기로 조용하게 */}
            {discount ? <span className="font-bold text-accent friendly:text-title-sm calm:text-body-sm calm:font-medium">{discount}%</span> : null}
            <span className={cx("friendly:text-title-sm friendly:font-bold calm:text-body-sm calm:font-medium", soldout ? "text-ink-3" : "text-ink")}>
              {won(price)}
              <span className="text-body-sm font-medium calm:font-normal">원</span>
            </span>
          </p>
        ) : null}
        {variant === "compare" && discount && priceOriginal ? (
          <p className="text-label text-ink-3 line-through">{won(priceOriginal)}원</p>
        ) : null}
        {meta ? <p className="mt-1 truncate text-label text-ink-3">{meta}</p> : null}
      </div>
    </>
  );

  const shell = cx(
    "group/card block w-full text-left",
    framed && "friendly:rounded-card friendly:bg-surface friendly:p-3 friendly:shadow-card friendly:transition-shadow friendly:hover:shadow-raised",
  );

  if (href)
    return (
      <a href={href} className={shell}>
        {Body}
      </a>
    );
  return <div className={cx(shell, "relative")}>{Body}</div>;
}
