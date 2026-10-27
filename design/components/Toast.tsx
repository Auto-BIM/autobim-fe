"use client";
/**
 * Toast — 방금 한 행동의 결과를 짧게 알린다. 한 번에 하나만 (새 알림이 이전 것을 바꾼다).
 *
 * 규칙
 * - 문장은 해요체 한 줄. "저장했어요", "목록에 담았어요".
 * - 되돌릴 수 있으면 action으로 "되돌리기"를 준다. 링크 하나까지만.
 * - 4초 뒤 사라지고, 마우스를 올리거나 포커스하면 멈춘다.
 * - 오류 중 사용자가 고쳐야 하는 것은 토스트가 아니라 해당 칸 아래에 적는다.
 * - 위치: 아래 가운데. 모바일 하단 고정 버튼이 있으면 그 위로.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { IconAlert, IconCheck } from "./icons";

type ToastInput = { message: string; tone?: "neutral" | "success" | "error"; action?: { label: string; onClick: () => void } };
type ToastState = ToastInput & { id: number };

const Ctx = createContext<(t: ToastInput) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children, offset = 24 }: { children: ReactNode; offset?: number }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((t: ToastInput) => setToast({ ...t, id: Date.now() }), []);

  useEffect(() => {
    if (!toast || paused) return;
    timer.current = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer.current);
  }, [toast, paused]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-60 flex justify-center px-4"
        style={{ bottom: `max(${offset}px, env(safe-area-inset-bottom))` }}
      >
        {toast ? (
          <div
            key={toast.id}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className={cx(
              "pointer-events-auto flex max-w-md items-center gap-3 rounded-control bg-ink px-4 py-3 text-body-sm text-bg shadow-raised",
              "animate-rise-in calm:rounded-none",
            )}
          >
            {toast.tone === "success" ? <IconCheck size={18} className="shrink-0" /> : null}
            {toast.tone === "error" ? <IconAlert size={18} className="shrink-0" /> : null}
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                className="shrink-0 font-semibold underline underline-offset-4"
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}
