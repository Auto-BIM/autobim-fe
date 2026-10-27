"use client";
/**
 * SiteHeader — 왼쪽 이름(로고), 가운데/오른쪽 주 메뉴 최대 5개, 행동 버튼 최대 1개.
 * 모바일(768px 미만): 이름 + 오른쪽 위 메뉴 버튼 하나만. 메뉴는 Drawer로 연다.
 *
 * 규칙
 * - 메뉴 항목은 모두 같은 색·같은 굵기. 현재 페이지만 진하고 굵게. 항목마다 색을 다르게 하지 않는다.
 * - 맨 위 광고·공지 띠를 두지 않는다. 꼭 필요한 공지는 한 줄, 닫을 수 있게.
 * - 내려가면 바탕이 생기고 아래 선 1px. 그 외 장식 없음.
 */
import { useEffect, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import { Drawer, type NavItem } from "./Drawer";
import { IconMenu } from "./icons";

export function SiteHeader({
  brand,
  items,
  action,
  secondary,
  sticky = true,
  menuLabel,
}: {
  brand: ReactNode;
  items: NavItem[];
  /** 행동 버튼 1개 (예: <Button size="sm">시작하기</Button>) */
  action?: ReactNode;
  secondary?: NavItem[];
  sticky?: boolean;
  /** 메뉴 버튼을 아이콘 대신 글자로 (예: "메뉴", "Menu") — 사이트 분위기에 따라 */
  menuLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // 프레임워크마다 개발 모드 표시 방법이 달라서, 잘못 쓴 경우에만 항상 경고한다
  if (items.length > 5) {
    console.warn(`[SiteHeader] 주 메뉴는 5개 이하로 (지금 ${items.length}개). 나머지는 secondary로 옮기세요.`);
  }

  useEffect(() => {
    if (!sticky) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sticky]);

  return (
    <header
      className={cx(
        "z-30 w-full transition-[background-color,border-color] duration-200",
        sticky && "sticky top-0",
        scrolled ? "border-b border-line bg-bg/92 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center gap-6">
        <div className="mr-auto flex shrink-0 items-center text-body font-bold calm:font-display calm:font-semibold">
          {brand}
        </div>
        <nav aria-label="주 메뉴" className="hidden md:block">
          <ul className="flex items-center gap-7">
            {items.slice(0, 5).map((it) => (
              <li key={it.href}>
                <a
                  href={it.href}
                  aria-current={it.current ? "page" : undefined}
                  className={cx(
                    "text-body-sm transition-colors duration-150",
                    it.current ? "font-semibold text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {action ? <div className="hidden md:block">{action}</div> : null}
        {menuLabel ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="-mr-2 h-11 px-2 text-body-sm font-medium text-ink underline-offset-4 hover:underline md:hidden"
          >
            {menuLabel}
          </button>
        ) : (
          <IconButton label="메뉴 열기" onClick={() => setOpen(true)} className="-mr-3 md:hidden" aria-haspopup="dialog">
            <IconMenu />
          </IconButton>
        )}
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        secondary={secondary}
        footer={action ? <div className="[&>*]:w-full">{action}</div> : undefined}
      />
    </header>
  );
}
