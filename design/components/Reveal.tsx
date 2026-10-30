"use client";
/**
 * Reveal — 쇼케이스 움직임(v0.2)의 "드러내기·떠오르기"를 섹션당 1회 붙이는 틀.
 *
 * 규칙 (DESIGN.md 8장)
 * - 디렉션이 있는 사이트에서만, 큰 이미지(reveal) 또는 큰 제목 한 줄(lift)에만 쓴다. 문단·버튼에 쓰지 않는다.
 * - 화면에 처음 들어올 때 한 번만. 다시 올라가도 반복하지 않는다.
 * - 움직임 줄이기 설정이거나 JS가 아직 안 돌았으면 **처음부터 보이는 상태**다 (숨겨 두고 기다리지 않는다).
 * - 이미 첫 화면 안에 있는 요소는 기다리지 않고 바로 재생한다.
 * - reveal은 아래에서 위로 드러난다(clip-path). 임의 값 clip-path는 시작 상태를 keyframes와 맞추려고 쓴다.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

export function Reveal({
  children,
  kind = "reveal",
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  kind?: "reveal" | "lift";
  className?: string;
  as?: "div" | "figure" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"idle" | "wait" | "play">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setState("play");
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9) setState("play");
    else {
      setState("wait");
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // 관찰은 바깥 틀에서, 잘라내기·투명은 안쪽에서 한다 (clip-path가 걸린 요소는 교차 비율이 0으로 잡힌다)
  return (
    <Tag ref={ref as never} className={className}>
      <div
        className={cx(
          "h-full",
          kind === "reveal" && "overflow-hidden",
          state === "wait" && (kind === "reveal" ? "[clip-path:inset(100%_0_0_0)]" : "opacity-0"),
          state === "play" && (kind === "reveal" ? "animate-reveal" : "animate-lift"),
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
