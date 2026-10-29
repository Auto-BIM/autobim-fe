"use client";
/**
 * Dialog — 보던 화면 위에 여는 창 (짧은 상세, 로그인, 확인).
 * 브라우저 기본 <dialog>.showModal()을 쓴다 → 포커스 가두기, Esc 닫기, 뒤 화면 비활성, 닫으면 원래 자리로 포커스 복귀.
 *
 * 규칙
 * - 창 안에 또 창을 열지 않는다 (화면 층은 최대 3: 바탕 · 내용 · 창).
 * - 제목은 필수. 행동 버튼은 오른쪽 아래: [취소(text)] [주 행동(primary)].
 * - 위험한 확인은 주 행동을 danger로, 버튼 글자에 결과를 쓴다 ("삭제" ✓ / "확인" ✗).
 * - 모바일(640px 미만)에서는 아래에서 올라오는 시트로 바뀐다.
 * - 바깥(어두운 부분)을 누르면 닫힌다. 입력 중인 폼이면 dismissible={false}.
 *   v0.2.1: 누르기 시작한 곳도 바깥이어야 닫힌다 — 창 안에서 끌다가 바깥에서 놓으면 닫히지 않게(평면에 그리기 등).
 * - size="xl"(v0.2.1): 창 안에서 그리거나 고치는 도구 창(평면 + 옆 설정). 짧은 확인에는 쓰지 않는다.
 *   가운데가 아니라 위에 붙인다 — 그린 뒤 옆 설정이 늘어나면 가운데 창은 위로 밀려 그리는 칸이 움직였다(Auto-BIM 계단 그리기).
 */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import { IconClose } from "./icons";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onPointerDown={(e) => {
        pressedOutside.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (dismissible && pressedOutside.current && e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto max-h-[min(88dvh,820px)] w-[calc(100%-32px)] overflow-hidden rounded-dialog bg-surface p-0 text-ink shadow-overlay",
        "backdrop:bg-scrim backdrop:animate-fade-in open:animate-rise-in",
        size === "sm" && "max-w-sm",
        size === "md" && "max-w-lg",
        size === "lg" && "max-w-3xl",
        size === "xl" && "max-w-5xl sm:mt-16 sm:mb-auto",
        // 모바일: 아래 시트
        "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none",
      )}
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-4 px-6 pt-6 pb-2 max-sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-title-sm font-bold calm:font-display calm:font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1.5 text-body-sm text-ink-2">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="닫기" onClick={onClose} className="-mt-2 -mr-3">
            <IconClose />
          </IconButton>
        </header>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 max-sm:px-5">{children}</div> : null}
        {actions ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 px-6 pt-2 pb-6 max-sm:px-5 max-sm:pb-[max(20px,env(safe-area-inset-bottom))]">
            {actions}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
