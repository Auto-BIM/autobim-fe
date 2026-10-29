/**
 * MenuList — 메뉴판 (v0.2, patterns.md 10장). 묶음 → 항목(이름 · 한 줄 설명 · 가격).
 *
 *   처음                                    ← 묶음 이름: 이 가게의 말로 (title-lg 명조) + 영문 micro 라벨(선택)
 *   ───────────────────────────────────────
 *   ● 계절 늙은 호박 수프          14,000    ← "계절"은 강조색 점 + 글자 (강조색의 한 가지 의미, 색만으로 전하지 않는다)
 *     구운 호박씨, 들기름
 *
 * 규칙
 * - 사진을 항목마다 붙이지 않는다 (사진은 DragGallery로 따로).
 * - 가격은 numerals로 오른쪽 정렬. 표기는 사이트 전체 통일(unit).
 * - 매운 정도·알레르기는 아이콘이 아니라 글자(note)로.
 * - 데이터는 페이지가 아니라 content 파일에서 넘긴다 (사장님이 고치기 쉽게).
 */
import { cx } from "./cx";

export type MenuItem = { name: string; desc?: string; price: number | string; seasonal?: boolean; note?: string };
export type MenuSection = { id: string; title: string; label?: string; items: MenuItem[] };

const won = (n: number) => n.toLocaleString("ko-KR");

export function MenuList({
  sections,
  unit = "",
  seasonalLabel = "계절",
  className,
}: {
  sections: MenuSection[];
  /** 가격 뒤 단위 ("" 또는 "원") — 사이트 전체에서 하나로 */
  unit?: string;
  seasonalLabel?: string;
  className?: string;
}) {
  return (
    <div className={cx("grid gap-14 md:gap-16", className)}>
      {sections.map((sec) => (
        <section key={sec.id} aria-labelledby={`menu-${sec.id}`}>
          <header className="mb-4 flex items-baseline justify-between gap-4">
            <h3 id={`menu-${sec.id}`} className="font-display text-title-lg tracking-title text-ink">
              {sec.title}
            </h3>
            {sec.label ? <span className="micro-label text-ink-3">{sec.label}</span> : null}
          </header>
          <ul>
            {sec.items.map((it) => (
              <li key={it.name} className="grid grid-cols-[1fr_auto] gap-x-6 border-t border-line py-4 last:border-b">
                <div>
                  <p className="flex items-center gap-2 text-body font-medium text-ink">
                    {it.seasonal ? (
                      <span className="inline-flex items-center gap-1.5 text-label font-semibold text-accent">
                        <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                        <span>{seasonalLabel}</span>
                      </span>
                    ) : null}
                    {it.name}
                  </p>
                  {it.desc ? <p className="mt-1 text-body-sm text-ink-2">{it.desc}</p> : null}
                  {it.note ? <p className="mt-1 text-label text-ink-3">{it.note}</p> : null}
                </div>
                <p className="numerals text-body text-ink">
                  {typeof it.price === "number" ? won(it.price) : it.price}
                  {typeof it.price === "number" && unit ? <span className="ml-0.5 text-body-sm text-ink-2">{unit}</span> : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
