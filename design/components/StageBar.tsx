"use client";
/**
 * StageBar — 무대(3D·지도·캔버스) 아래 가장자리의 도구 줄 (patterns C형 도구형 변형, v0.2.1).
 *   넓은 화면(md~): 무대 위에 떠 있다 — 반투명 바탕 + 1px 선, 무대 가장자리에서 12px.
 *   좁은 화면: 무대 아래로 내려와 붙는다 — 소재를 가리지 않게.
 *   왜: 375px에서 도구가 두 줄로 접히자 떠 있는 줄이 3D 모델의 절반을 덮었다(Auto-BIM, 2026-10-30).
 *
 * 쓰는 법 — 무대를 relative 바깥 틀로 감싸고, [고정 비율 소재 칸]과 StageBar를 형제로 둔다.
 *   <div className="relative bg-surface-2">
 *     <div className="relative aspect-4/3">…캔버스…</div>
 *     <StageBar label="보이기">…</StageBar>
 *   </div>
 *   넓은 화면에서는 StageBar가 흐름에서 빠지므로 바깥 틀 높이 = 소재 칸 높이가 된다.
 *
 * 규칙
 * - 한 무대에 아래 도구 줄은 하나. 위 왼쪽 보기 전환(Segmented floating)과 합쳐 무대 위 도구는 두 묶음까지.
 * - 줄 안에는 누르면 바로 반영되는 도구만(Segmented · 작은 Checkbox · 범위 슬라이더). 저장·적용 같은 주 행동은 옆 패널로.
 * - label은 화면낭독기 그룹 이름. 보이는 앞머리 글자가 필요 없으면 showLabel={false}.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";

export function StageBar({
  label,
  showLabel = true,
  children,
  className,
}: {
  /** 그룹 이름 (예: "보이기", "3D 도구") */
  label: string;
  showLabel?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-floating="" /* 사이트 테마가 무대 위 도구 모양(예: 유리판)을 덮어쓸 수 있는 자리 */
      className={cx(
        "flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-bg px-3 py-2.5",
        "md:absolute md:inset-x-3 md:bottom-3 md:z-10 md:rounded-control md:border md:bg-bg/90 md:py-2 md:backdrop-blur-md",
        className,
      )}
    >
      {showLabel ? <span className="text-label text-ink-3">{label}</span> : null}
      {children}
    </div>
  );
}
