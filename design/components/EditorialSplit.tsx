/**
 * EditorialSplit — 사진 반 + 글 반 (v0.2). 소개·공간·브랜드 이야기에 쓴다.
 *
 *   ┌──────────────┬──────────────┐
 *   │   사진 4/5   │ MICRO LABEL  │
 *   │ (가장자리까지)│ 제목(명조)    │
 *   │              │ 문단 ≤2      │
 *   │              │ CreditList   │
 *   └──────────────┴──────────────┘
 *
 * 규칙
 * - 사진은 화면 가장자리까지 붙는다(bleed). 글 단은 최대 520px, 위아래 가운데가 아니라 **위에서 시작**한다.
 * - reverse로 좌우를 바꿀 수 있지만, 한 페이지에서 번갈아 쓰는 건 2번까지.
 * - 모바일: 사진 → 글 순서로 한 열.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";

export function EditorialSplit({
  media,
  children,
  reverse,
  className,
}: {
  media: ReactNode;
  children: ReactNode;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <section className={cx("grid md:grid-cols-2", className)}>
      <div className={cx("relative", reverse && "md:order-2")}>{media}</div>
      <div className={cx("flex px-5 py-14 md:px-12 md:py-24 lg:px-20", reverse && "md:order-1")}>
        <div className="w-full max-w-130">{children}</div>
      </div>
    </section>
  );
}
