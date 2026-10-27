"use client";
/**
 * Chip — 누르면 켜지고 꺼지는 필터. 선택은 색이 아니라 "진하기"로 보인다.
 *   friendly : 둥근 알약, 선택 시 글자색 바탕으로 반전
 *   calm     : 각진 테두리, 선택 시 테두리·글자가 진해지고 굵어짐
 * Badge — 누를 수 없는 짧은 표시(상태·분류). 한 카드에 최대 1개.
 *   tone="accent" + dot 은 사이트의 "작은 반복 장치"로 쓸 수 있다 (예: 새 글, 진행 중).
 */
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./cx";
import { IconCheck } from "./icons";

export function Chip({
  selected = false,
  count,
  children,
  className,
  ...rest
}: Omit<ComponentPropsWithoutRef<"button">, "children"> & { selected?: boolean; count?: number; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-chip px-3.5 text-body-sm transition-colors duration-150",
        "friendly:bg-surface friendly:text-ink-2 friendly:ring-1 friendly:ring-inset friendly:ring-line friendly:hover:ring-line-strong friendly:hover:text-ink",
        "friendly:aria-pressed:bg-ink friendly:aria-pressed:text-bg friendly:aria-pressed:ring-ink friendly:aria-pressed:font-semibold",
        "calm:border calm:border-line calm:text-ink-2 calm:hover:border-line-strong calm:hover:text-ink",
        "calm:aria-pressed:border-ink calm:aria-pressed:text-ink calm:aria-pressed:font-semibold",
        className,
      )}
      {...rest}
    >
      {selected ? <IconCheck size={14} strokeWidth={2.25} className="calm:hidden" /> : null}
      {children}
      {typeof count === "number" ? <span className="text-label font-normal opacity-70">{count}</span> : null}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: "neutral" | "accent" | "danger" | "success" | "inverse";
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-chip px-2 text-label font-medium",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "success" && "bg-success/10 text-success",
        tone === "inverse" && "bg-ink text-bg",
        dot && "pl-1.5 font-semibold",
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-2 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
