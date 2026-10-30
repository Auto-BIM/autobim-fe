"use client";
/**
 * Segmented — 몇 개 중 하나를 고르는 붙은 버튼 줄 (보기 전환 · 시점 · 층 고르기).
 *   선택된 칸만 반전(바탕 ink · 글자 bg) — R19의 "반전 막대" 원리. 나머지는 조용한 ink-2.
 *
 * 규칙
 * - 칸은 2~6개. 그보다 많으면 Select나 목록으로.
 * - 글자는 1~2단어. 숫자가 붙으면 count로(예: 평면 3 — 바뀔 내용 개수).
 * - 같은 화면에서 같은 일을 하는 붙은 버튼은 이 부품 하나로 만든다(페이지마다 따로 그리지 않는다 — 풀스택 10장).
 * - 키보드: Tab으로 들어와 ←/→로 고른다(라디오 그룹). 고르면 바로 바뀐다.
 * - floating: 3D·지도 같은 무대 위에 떠 있을 때(반투명 바탕 + 1px 선). 무대 위 도구는 이걸 쓴다(patterns C형 도구형).
 */
import { useRef, type ReactNode } from "react";
import { cx } from "./cx";

export type SegmentOption<T extends string> = { value: T; label: ReactNode; count?: number; disabled?: boolean };

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  size = "md",
  floating = false,
  className,
}: {
  /** 화면낭독기용 이름 (예: "보기", "시점", "층") */
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  size?: "sm" | "md";
  floating?: boolean;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.filter((o) => !o.disabled);
  const move = (dir: 1 | -1) => {
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + dir + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };
  if (options.length > 6) {
    console.warn(`[Segmented] 칸은 6개 이하로 (지금 ${options.length}개). 더 많으면 Select를 쓰세요.`);
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-floating={floating ? "" : undefined} /* 사이트 테마가 무대 위 도구 모양(예: 유리판)을 덮어쓸 수 있는 자리 */
      className={cx(
        "inline-flex shrink-0 overflow-hidden rounded-control border",
        floating ? "border-line bg-bg/90 backdrop-blur-md" : "border-line bg-surface",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 whitespace-nowrap border-l border-line transition-colors duration-150 first:border-l-0",
              size === "sm" ? "h-8 px-3 text-label" : "h-9 px-3.5 text-body-sm",
              on ? "bg-ink font-medium text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {o.label}
            {typeof o.count === "number" ? <span className={cx("numerals text-label", on ? "opacity-80" : "text-ink-3")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
