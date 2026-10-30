"use client";
/**
 * IndexList — 큰 글자 목록 + (선택) 미리보기 (v0.2). 작품 목록, 객실, 코스 단계처럼 "이름이 곧 입구"인 목록.
 *
 *   01  가을 저녁 코스          ← 올리거나 포커스한 줄만 ink, 나머지는 ink-3
 *   02  바 자리                      ┌──────────┐
 *   03  단체 저녁                    │ 미리보기 │ ← preview가 있으면 데스크톱에서 오른쪽에 고정
 *                                    └──────────┘
 * 규칙
 * - 항목 3~9개. 글자는 title-lg~display-sm, 번호·메타는 micro-label.
 * - 흐려진 줄도 대비 4.5:1(ink-3)을 지킨다 — 읽을 수 없게 흐리지 않는다.
 * - 미리보기는 같은 비율. 모바일에서는 미리보기를 숨기고 목록만 (누르면 이동).
 */
import { useState, type ReactNode } from "react";
import { cx } from "./cx";

export type IndexItem = { id: string; label: string; meta?: string; href?: string; preview?: ReactNode };

export function IndexList({ items, numbered = true, className }: { items: IndexItem[]; numbered?: boolean; className?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const hasPreview = items.some((i) => i.preview);
  const shown = items.find((i) => i.id === active) ?? items[0];
  return (
    <div className={cx("grid gap-10", hasPreview && "md:grid-cols-[1fr_minmax(0,22rem)]", className)}>
      <ol onMouseLeave={() => setActive(null)}>
        {items.map((it, i) => {
          const dim = active !== null && active !== it.id;
          const Row = it.href ? "a" : "div";
          return (
            <li key={it.id} className="border-t border-line last:border-b">
              <Row
                {...(it.href ? { href: it.href } : { tabIndex: 0 })}
                onMouseEnter={() => setActive(it.id)}
                onFocus={() => setActive(it.id)}
                onBlur={() => setActive(null)}
                className={cx(
                  "grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 py-4 transition-colors duration-200 md:py-5",
                  dim ? "text-ink-3" : "text-ink",
                )}
              >
                <span className="micro-label numerals text-ink-3">{numbered ? String(i + 1).padStart(2, "0") : ""}</span>
                <span className="font-display text-title-lg tracking-title md:text-display-sm">{it.label}</span>
                {it.meta ? <span className="micro-label text-ink-3">{it.meta}</span> : <span />}
              </Row>
            </li>
          );
        })}
      </ol>
      {hasPreview ? <div className="sticky top-24 hidden self-start md:block">{shown?.preview}</div> : null}
    </div>
  );
}
