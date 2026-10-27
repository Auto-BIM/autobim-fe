/**
 * Skeleton — 불러오는 동안 실제 모양과 같은 자리를 먼저 그린다 (빙글 도는 표시보다 우선).
 * - 0.3초 안에 끝날 일에는 보여주지 않는다 (깜박임 방지 — 쓰는 쪽에서 지연 후 표시).
 * - 움직임 줄이기 설정이면 반짝임 없이 고정.
 */
import { cx } from "./cx";
import type { Ratio } from "./MediaCard";

const shimmer =
  "bg-surface-2 bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--color-surface)_60%,transparent)_50%,transparent_100%)] " +
  "bg-size-[200%_100%] animate-shimmer motion-reduce:animate-none";

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx("block rounded-check", shimmer, className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cx("block space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx("h-3.5", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </span>
  );
}

const ratioClass: Record<Ratio, string> = {
  "1/1": "aspect-square",
  "4/5": "aspect-4/5",
  "3/4": "aspect-3/4",
  "2/3": "aspect-2/3",
  "3/2": "aspect-3/2",
  "16/9": "aspect-video",
};

/** MediaCard와 같은 모양의 자리 */
export function SkeletonCard({ ratio = "4/5" }: { ratio?: Ratio }) {
  return (
    <div aria-hidden className="w-full">
      <span className={cx("block w-full rounded-media", ratioClass[ratio], shimmer)} />
      <Skeleton className="mt-3 h-4 w-4/5" />
      <Skeleton className="mt-2 h-3 w-2/5" />
    </div>
  );
}
