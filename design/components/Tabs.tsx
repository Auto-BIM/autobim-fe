"use client";
/**
 * Tabs — 가벼운 글자 탭. 선택된 탭만 굵게 + 밑줄(2px). 배경색 띠·상자 탭은 쓰지 않는다.
 * 키보드: ←/→ 이동, Home/End 처음·끝. (WAI-ARIA Tabs 패턴, 자동 활성화)
 * 탭이 5개를 넘으면 가로 스크롤(모바일) — 줄바꿈하지 않는다.
 */
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export type TabItem = { id: string; label: string; count?: number; content: ReactNode };

export function Tabs({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** 탭 묶음의 이름 (화면낭독기용). 예: "상품 정보" */
  label: string;
  className?: string;
}) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, items.findIndex((t) => t.id === value));

  function onKeyDown(e: KeyboardEvent) {
    const last = items.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-6 overflow-x-auto border-b border-line [scrollbar-width:none]"
      >
        {items.map((t, i) => {
          const selected = i === index;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={cx(
                "relative -mb-px h-12 shrink-0 whitespace-nowrap text-body transition-colors duration-150",
                "text-ink-3 hover:text-ink-2",
                "aria-selected:font-semibold aria-selected:text-ink",
                "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-ink after:scale-x-0 after:transition-transform after:duration-200",
                "aria-selected:after:scale-x-100",
              )}
            >
              {t.label}
              {typeof t.count === "number" ? <span className="ml-1 text-label text-ink-3">{t.count}</span> : null}
            </button>
          );
        })}
      </div>
      {items.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={i !== index}
          tabIndex={0}
          className="pt-6 focus-visible:outline-offset-4"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
