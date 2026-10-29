/**
 * 아이콘 — 이 플레이북에서 직접 그린 단순 도형만 쓴다 (외부 아이콘 세트 복사 없음).
 * 24×24 격자, 선 굵기 1.75, 끝 둥글게. 색은 currentColor를 따른다.
 * 장식용이면 aria-hidden(기본), 의미가 있으면 title을 넘긴다.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string; size?: number };

function Svg({ title, size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => (
  <Svg {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);
export const IconMenu = (p: IconProps) => (
  <Svg {...p}><path d="M4 8h16M4 16h16" /></Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}><path d="M7 10l5 5 5-5" /></Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}><path d="M10 7l5 5-5 5" /></Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.75" /></Svg>
);
export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}><path d="M4 4l16 16" /><path d="M9.9 6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.6 3.4M14.1 18.1A9.4 9.4 0 0 1 12 18.5C6 18.5 2.5 12 2.5 12a17 17 0 0 1 3-3.8" /></Svg>
);
export const IconLock = (p: IconProps) => (
  <Svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Svg>
);
export const IconAlert = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.25v.01" /></Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const IconTrend = (p: IconProps) => (
  <Svg {...p}><path d="M4 16l5-5 4 3 7-7" /><path d="M15 7h5v5" /></Svg>
);
/** 결과 없음 그림 — 돋보기 + 빈 점선 */
export const IconNoResult = (p: IconProps) => (
  <Svg {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /><path d="M8 10.5h5" strokeDasharray="1.5 2" /></Svg>
);

/* v0.2 — 쇼케이스 부품용 (직접 그림) */
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>
);
export const IconPlay = (p: IconProps) => (
  <Svg {...p}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" /></Svg>
);
export const IconPause = (p: IconProps) => (
  <Svg {...p}><path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth={2.25} /></Svg>
);
export const IconSound = (p: IconProps) => (
  <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /></Svg>
);
export const IconMute = (p: IconProps) => (
  <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></Svg>
);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h4" /></Svg>
);
/** 별 — amount: 0(빈) · 0.5(반) · 1(꽉) */
export function IconStar({ amount = 1, size = 14, ...p }: Omit<IconProps, "fill"> & { amount?: 0 | 0.5 | 1 }) {
  const id = `star-half-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
      {amount === 0.5 ? (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.22" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M12 2.8l2.75 5.9 6.45.75-4.78 4.4 1.28 6.37L12 17.05l-5.7 3.17 1.28-6.37L2.8 9.45l6.45-.75z"
        fill={amount === 0.5 ? `url(#${id})` : "currentColor"}
        fillOpacity={amount === 0 ? 0.22 : 1}
      />
    </svg>
  );
}
