"use client";
/**
 * Drawer — 오른쪽에서 열리는 메뉴 서랍. 메뉴 버튼은 화면 오른쪽 위 하나뿐.
 *
 * 규칙
 * - 폭은 내용에 맞게(최대 384px). 화면 전체를 덮는 메뉴판으로 만들지 않는다.
 * - 항목은 크게(20px), 구분선 대신 여백으로 묶는다. 묶음은 최대 2개 (주 메뉴 / 보조 링크).
 * - 현재 페이지는 굵게 + 앞에 작은 점. 배경색 띠로 표시하지 않는다.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import { IconClose } from "./icons";

export type NavItem = { label: string; href: string; current?: boolean };

export function Drawer({
  open,
  onClose,
  items,
  secondary,
  footer,
  title = "메뉴",
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  secondary?: NavItem[];
  footer?: ReactNode;
  title?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        "ml-auto mr-0 h-dvh max-h-none w-max min-w-64 max-w-[min(20rem,88vw)] bg-surface p-0 text-ink shadow-overlay",
        "backdrop:bg-scrim backdrop:animate-fade-in open:animate-sheet-in",
      )}
    >
      <div className="flex h-full flex-col px-7 pt-4 pb-8">
        <div className="flex justify-end">
          <IconButton label="메뉴 닫기" onClick={onClose} className="-mr-3">
            <IconClose />
          </IconButton>
        </div>
        <nav aria-label="주 메뉴" className="mt-6">
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.href}>
                <a
                  href={it.href}
                  aria-current={it.current ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-2.5 py-2 text-title-sm transition-colors duration-150 calm:font-display",
                    it.current ? "font-bold text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  <span aria-hidden className={cx("size-1.5 rounded-full bg-accent", !it.current && "invisible")} />
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {secondary?.length ? (
          <ul className="mt-10 space-y-2 pl-4">
            {secondary.map((it) => (
              <li key={it.href}>
                <a href={it.href} className="text-body-sm text-ink-3 hover:text-ink">
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {footer ? <div className="mt-auto pt-8">{footer}</div> : null}
      </div>
    </dialog>
  );
}
