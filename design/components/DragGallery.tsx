"use client";
/**
 * DragGallery — 끌어서 넘기는 가로 사진 줄 (v0.2). 음식·작품·공간 사진을 "한 줄"로 모은다.
 *
 * 규칙
 * - 같은 비율(기본 4/5), 같은 너비. 사진 아래 라벨 한 줄(micro) + 이름 한 줄.
 * - 끌기(마우스)·밀기(터치)·버튼·키보드(←/→) 모두로 넘길 수 있다. 자동으로 넘어가지 않는다(F).
 * - 다음 사진 일부가 보이게 해서 "더 있다"를 알린다. 맨 위 오른쪽에 "2 / 6"과 이전·다음 버튼.
 * - 한 페이지에 1줄까지.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import { IconChevronLeft, IconChevronRight } from "./icons";

export type GalleryItem = { id: string; media: ReactNode; label?: string; title: string };

export function DragGallery({ items, title, className }: { items: GalleryItem[]; title?: ReactNode; className?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (!first) return;
      setIndex(Math.round(el.scrollLeft / (first.offsetWidth + 16)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    el.scrollBy({ left: dir * (first.offsetWidth + 16), behavior: "smooth" });
  };

  return (
    <section className={className} aria-roledescription="사진 줄">
      <div className="container-wide mb-5 flex items-end justify-between gap-4">
        <div>{title}</div>
        <div className="flex items-center gap-1">
          <span className="micro-label numerals mr-2 whitespace-nowrap text-ink-3" aria-live="polite">
            {Math.min(index + 1, items.length)} / {items.length}
          </span>
          <IconButton label="이전 사진" size="sm" onClick={() => go(-1)}>
            <IconChevronLeft size={18} />
          </IconButton>
          <IconButton label="다음 사진" size="sm" onClick={() => go(1)}>
            <IconChevronRight size={18} />
          </IconButton>
        </div>
      </div>
      <ul
        ref={track}
        tabIndex={0}
        aria-label="사진 목록 — 좌우 화살표로 넘겨요"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !track.current) return;
          drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false };
          track.current.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current, el = track.current;
          if (!d || !el) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4) d.moved = true;
          el.scrollLeft = d.left - dx;
        }}
        onPointerUp={(e) => {
          const d = drag.current, el = track.current;
          drag.current = null;
          if (!d || !el || !d.moved) return;
          // 관성: 끈 방향으로 한 장 더 부드럽게 맞춘다 (scroll-snap이 마무리)
          const first = el.firstElementChild as HTMLElement | null;
          if (first) el.scrollBy({ left: Math.sign(d.x - e.clientX) * first.offsetWidth * 0.35, behavior: "smooth" });
        }}
        className={cx(
          "flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 select-none active:cursor-grabbing",
          "scroll-px-5 px-5 md:scroll-px-8 md:px-8 xl:scroll-px-14 xl:px-14",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {items.map((it) => (
          <li key={it.id} className="w-[72vw] shrink-0 snap-start sm:w-[44vw] lg:w-[26vw] xl:w-[22rem]">
            <div className="pointer-events-none overflow-hidden rounded-media [&_img]:transition-transform [&_img]:duration-300 [&_img]:ease-standard">{it.media}</div>
            {it.label ? <p className="micro-label mt-3 text-ink-3">{it.label}</p> : null}
            <p className="mt-1 text-body-sm text-ink">{it.title}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
