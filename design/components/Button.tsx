"use client";
/**
 * Button — 화면당 primary는 하나. 글자는 1~3단어("예약하기", "다음", "저장").
 *
 * variant
 *   primary   : 그 화면의 핵심 행동 1개. friendly=강조색, calm=진한 무채색
 *   secondary : 테두리. 보조 행동
 *   text      : 글자 링크처럼. 취소·더보기·전환 링크
 *   danger    : 되돌릴 수 없는 행동 (삭제·탈퇴). 확인 창과 함께 쓴다
 *
 * 상태: 기본 · 올림(hover) · 누름(active) · 포커스 · 처리 중(loading) · 잠김(disabledReason)
 *   잠긴 버튼은 반드시 "왜 안 되는지 + 어떻게 하면 되는지"를 disabledReason으로 적는다.
 *   (진짜 disabled 대신 aria-disabled를 써서 키보드·화면낭독기로도 이유를 읽을 수 있게 한다)
 */
import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx } from "./cx";
import { IconLock } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "text" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** 잠김 이유. 넣으면 버튼이 잠기고 아래에 이유가 보인다. 예: "약관에 동의하면 다음으로 갈 수 있어요" */
  disabledReason?: string;
  /** 앞쪽 아이콘 (선택) */
  icon?: ReactNode;
  /** 가로 꽉 채우기 (모바일 하단 고정 버튼 등) */
  block?: boolean;
  children: ReactNode;
};

type AsButton = Common & Omit<ComponentPropsWithoutRef<"button">, keyof Common> & { href?: undefined };
type AsLink = Common & Omit<ComponentPropsWithoutRef<"a">, keyof Common> & { href: string };
export type ButtonProps = AsButton | AsLink;

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap select-none rounded-control " +
  "font-semibold calm:font-medium transition-[background-color,color,box-shadow,transform] duration-150 ease-standard " +
  "active:scale-98";

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-body-sm",
  md: "h-11 px-5 text-body", // 44px — 손가락 최소 크기
  lg: "h-13 px-6 text-body",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-primary-hover",
  secondary: "bg-transparent text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-2",
  text: "bg-transparent text-ink-2 hover:text-ink underline-offset-4 hover:underline px-1.5!",
  danger: "bg-transparent text-danger ring-1 ring-inset ring-danger/45 hover:bg-danger/8",
};

// 잠김 모양은 disabledReason이 있을 때만 (처리 중에는 원래 색을 유지한다)
const locked =
  "data-locked:bg-surface-2 data-locked:text-ink-3 data-locked:ring-0 data-locked:hover:bg-surface-2 " +
  "data-locked:cursor-not-allowed data-locked:no-underline data-locked:active:scale-100 aria-busy:cursor-progress";

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    disabledReason,
    icon,
    block,
    children,
    className,
    ...rest
  } = props;
  const reasonId = useId();
  const isLocked = Boolean(disabledReason) || loading;

  const cls = cx(base, sizes[size], variants[variant], locked, block && "w-full", className);
  const inner = (
    <>
      {/* 처리 중에도 글자 폭을 유지해 버튼이 흔들리지 않게 한다 */}
      <span className={cx("inline-flex items-center gap-2", loading && "invisible")}>
        {icon}
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
          <span className="sr-only">처리 중</span>
        </span>
      ) : null}
    </>
  );

  const a11y = {
    "data-locked": disabledReason ? "" : undefined,
    "aria-disabled": isLocked || undefined,
    "aria-busy": loading || undefined,
    "aria-describedby": disabledReason ? reasonId : undefined,
  } as const;

  const control =
    "href" in rest && rest.href !== undefined ? (
      <a
        {...(rest as ComponentPropsWithoutRef<"a">)}
        {...a11y}
        className={cls}
        onClick={(e) => {
          if (isLocked) return e.preventDefault();
          (rest as ComponentPropsWithoutRef<"a">).onClick?.(e);
        }}
      >
        {inner}
      </a>
    ) : (
      <button
        type="button"
        {...(rest as ComponentPropsWithoutRef<"button">)}
        {...a11y}
        className={cls}
        onClick={(e) => {
          if (isLocked) return e.preventDefault();
          (rest as ComponentPropsWithoutRef<"button">).onClick?.(e);
        }}
      >
        {inner}
      </button>
    );

  if (!disabledReason) return control;
  return (
    <span className={cx("inline-flex flex-col items-start gap-1.5", block && "w-full")}>
      {control}
      <span id={reasonId} className="inline-flex items-center gap-1 text-label text-ink-3">
        <IconLock size={14} />
        {disabledReason}
      </span>
    </span>
  );
}

/** 아이콘만 있는 버튼 — aria-label 필수. 44×44 */
export function IconButton({
  label,
  children,
  className,
  size = "md",
  ...rest
}: Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  label: string;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-control text-ink-2 transition-colors duration-150",
        "hover:bg-surface-2 hover:text-ink",
        size === "md" ? "size-11" : "size-9",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
