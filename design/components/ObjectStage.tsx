"use client";
/**
 * ObjectStage — 오브젝트 쇼케이스형(object 디렉션) 화면 틀 (v0.2, patterns.md D형).
 * 가운데 주인공 오브젝트 하나 + 가장자리 컨트롤. 오브젝트 자체(three.js 캔버스·렌더 이미지·사진)는 children으로 넘긴다.
 *
 *   ┌ ← 이름 ─────── [ 만들기 | 모아보기 ] ──────────────┐
 *   │                                           ( ○ ) │
 *   │               주인공 오브젝트                ( ○ ) │ ← 도구 ≤4, 선택된 도구의 옵션은 왼쪽에 점으로
 *   │                                           ( ○ ) │
 *   │                 ▁▁▁ 바닥 그림자 ▁▁▁               │
 *   │ 작은 글자                          [ 주 행동 ]    │
 *   └──────────────────────────────────────────────────┘
 * 규칙
 * - 오브젝트는 화면 높이의 70% 이상. 주변에 설명 문단을 두지 않는다.
 * - 도구 버튼은 label 필수(IconButton 규칙), 44×44 이상. 5개 이상 금지.
 * - 끌어서 돌리기 같은 조작은 버튼으로도 할 수 있어야 한다(F).
 */
import type { ReactNode } from "react";
import { cx } from "./cx";

export type StageTool = { id: string; label: string; icon: ReactNode };

export function ObjectStage({
  children,
  topLeft,
  modeSwitch,
  tools = [],
  activeTool,
  onTool,
  toolOptions,
  action,
  footer,
  className,
}: {
  children: ReactNode;
  topLeft?: ReactNode;
  modeSwitch?: ReactNode;
  tools?: StageTool[];
  activeTool?: string;
  onTool?: (id: string) => void;
  toolOptions?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  // 프레임워크마다 개발 모드 표시 방법이 달라서, 잘못 쓴 경우에만 항상 경고한다 (SiteHeader와 같은 방식)
  if (tools.length > 4) {
    console.warn(`[ObjectStage] 도구는 4개 이하로 (지금 ${tools.length}개).`);
  }
  return (
    <section className={cx("relative isolate h-svh min-h-[36rem] w-full overflow-hidden bg-bg", className)}>
      <div aria-hidden className="absolute inset-x-[20%] bottom-[9%] -z-10 h-[6%] rounded-[50%] bg-ink/10 blur-2xl" />
      <div className="absolute inset-0 -z-0 grid place-items-center p-[6%]">{children}</div>
      {topLeft ? <div className="absolute top-5 left-5">{topLeft}</div> : null}
      {modeSwitch ? <div className="absolute top-5 left-1/2 -translate-x-1/2">{modeSwitch}</div> : null}
      {tools.length ? (
        <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-3 md:right-6">
          {toolOptions ? <div className="flex flex-col gap-2">{toolOptions}</div> : null}
          <ul className="flex flex-col gap-3">
            {tools.slice(0, 4).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  aria-label={t.label}
                  title={t.label}
                  aria-pressed={activeTool === t.id}
                  onClick={() => onTool?.(t.id)}
                  className={cx(
                    "grid size-14 place-items-center rounded-full bg-surface shadow-raised transition-[box-shadow,transform] duration-150 hover:scale-105",
                    activeTool === t.id && "ring-2 ring-ink",
                  )}
                >
                  {t.icon}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {footer ? <div className="absolute bottom-5 left-5 text-label text-ink-3">{footer}</div> : null}
      {action ? <div className="absolute right-5 bottom-5">{action}</div> : null}
    </section>
  );
}
