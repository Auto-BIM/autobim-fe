"use client";
/**
 * FullBleedMedia — 화면 폭을 꽉 채우는 사진·영상 + 왼쪽 아래 글자 한 덩어리 (v0.2, C형 첫 화면).
 *
 * 규칙
 * - 소재가 주인공. 글자는 아래쪽 한 덩어리(라벨 → 큰 한 줄 → 사실 한 줄 → 행동 하나)로만.
 * - 글자 아래에는 어둡게 깔기(scrim)가 자동으로 깔린다 → 대비 4.5:1(F). 소재의 밝은 부분이 글자 뒤에 오지 않게 구도를 고른다.
 * - 영상: 소리 꺼짐 · 반복 · 첫 프레임 이미지(poster) · 정지/소리 버튼(오른쪽 아래, 작게).
 *   움직임 줄이기 설정이면 재생하지 않고 poster만 보인다. 소리를 자동으로 켜지 않는다(F).
 * - height: screen(첫 화면, 100svh·모바일 88svh) / tall(88svh) / wide(16:9)
 * - focus: 세로 화면(모바일)에서 소재의 어느 쪽을 남길지. 글자 덩어리와 주인공이 겹치지 않는 쪽을 고른다.
 * 임의 값: 높이(svh)와 최소 높이 — 주소창이 움직이는 모바일에서 첫 화면 높이를 고정하려고 쓴다.
 * - 이 부품 안의 글자는 어두운 소재 위에 있으므로 data-mode="dark" 값으로 칠해진다.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import { IconMute, IconPause, IconPlay, IconSound } from "./icons";

export function FullBleedMedia({
  image,
  video,
  alt,
  height = "screen",
  focus = "center",
  children,
  className,
}: {
  /** 사진 (영상이면 poster로도 쓴다) */
  image: string;
  video?: string;
  alt: string;
  height?: "screen" | "tall" | "wide";
  focus?: "center" | "left" | "right";
  /** 왼쪽 아래 글자 덩어리 */
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const pos = focus === "left" ? "object-left" : focus === "right" ? "object-right md:object-center" : "object-center";

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setPlaying(true)).catch(() => undefined);
    else { v.pause(); setPlaying(false); }
  };

  return (
    <section
      data-mode="dark"
      className={cx(
        "relative isolate w-full overflow-hidden bg-bg text-ink",
        height === "screen" && "h-[88svh] min-h-[32rem] md:h-svh",
        height === "tall" && "h-[88svh] min-h-[28rem]",
        height === "wide" && "aspect-video",
        className,
      )}
    >
      {video ? (
        <video ref={ref} className={cx("absolute inset-0 -z-10 size-full object-cover", pos)} src={video} poster={image} muted={muted} loop playsInline aria-label={alt} />
      ) : (
        <img className={cx("absolute inset-0 -z-10 size-full object-cover", pos)} src={image} alt={alt} />
      )}
      {/* 글자 아래 어둡게 깔기 — 아래쪽 45%만 */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[55%] bg-linear-to-t from-scrim via-scrim/60 to-transparent" />
      {children ? <div className="container-wide absolute inset-x-0 bottom-0 pb-10 md:pb-14">{children}</div> : null}
      {video ? (
        <div className="absolute right-3 bottom-3 flex gap-1 md:right-6 md:bottom-6">
          <IconButton label={playing ? "영상 멈추기" : "영상 재생"} size="sm" onClick={toggle} className="text-ink">
            {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
          </IconButton>
          <IconButton label={muted ? "소리 켜기" : "소리 끄기"} size="sm" onClick={() => setMuted((m) => !m)} className="text-ink">
            {muted ? <IconMute size={16} /> : <IconSound size={16} />}
          </IconButton>
        </div>
      ) : null}
    </section>
  );
}
