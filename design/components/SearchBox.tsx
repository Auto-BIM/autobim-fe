"use client";
/**
 * SearchBox — 치는 동안 바로 반응하는 검색칸 (WAI-ARIA combobox + listbox).
 *
 * 동작
 * - 칸을 누르기만 해도: 최근 검색어 + 인기 검색어
 * - minChars(기본 2)글자부터: 추천 결과 미리보기(이미지·제목·한 줄) 최대 5개 + 맨 아래 "‘검색어’ 전체 결과 보기"
 * - 일치하는 글자는 굵게
 * - ↑/↓ 이동, Enter 선택(아무것도 고르지 않았으면 전체 검색), Esc 닫기 → 한 번 더 Esc면 입력 지우기
 * - 한글 조합 중 Enter는 무시한다 (조합이 끝나지 않은 글자로 검색되는 문제 방지)
 * - 추천이 하나도 없으면 "추천 결과가 없어요" + 전체 검색은 여전히 가능
 *
 * placeholder에는 "무엇을 찾을 수 있는지"를 적는다. 예: "작품, 작가, 분야로 찾아보세요"
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { IconClock, IconClose, IconSearch, IconTrend, IconArrowRight } from "./icons";
import { ImagePlaceholder } from "./MediaCard";

export type Suggestion = { id: string; title: string; sub?: string; thumb?: ReactNode; href?: string };

type Row =
  | { kind: "recent" | "popular"; text: string }
  | { kind: "suggestion"; item: Suggestion }
  | { kind: "all"; text: string };

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-bold text-ink">{text.slice(i, i + q.length)}</strong>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchBox({
  label = "검색",
  placeholder,
  recent = [],
  popular = [],
  getSuggestions,
  onSubmit,
  onSelect,
  onClearRecent,
  minChars = 2,
  defaultOpen = false,
  defaultValue = "",
  className,
}: {
  label?: string;
  placeholder: string;
  recent?: string[];
  popular?: string[];
  getSuggestions: (q: string) => Promise<Suggestion[]> | Suggestion[];
  onSubmit: (q: string) => void;
  onSelect?: (s: Suggestion) => void;
  onClearRecent?: () => void;
  minChars?: number;
  /** 스타일 가이드에서 열린 상태를 보여줄 때만 */
  defaultOpen?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(defaultOpen);
  const [active, setActive] = useState(-1);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const typing = q.trim().length >= minChars;

  // 추천 불러오기 (150ms 묶어서)
  useEffect(() => {
    if (!typing) {
      setItems([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await getSuggestions(q.trim());
      if (alive) {
        setItems(r.slice(0, 5));
        setLoading(false);
      }
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, typing, getSuggestions]);

  // 바깥 누르면 닫기
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const rows: Row[] = useMemo(() => {
    if (typing) return [...items.map((item) => ({ kind: "suggestion" as const, item })), { kind: "all" as const, text: q.trim() }];
    return [
      ...recent.slice(0, 5).map((text) => ({ kind: "recent" as const, text })),
      ...popular.slice(0, 5).map((text) => ({ kind: "popular" as const, text })),
    ];
  }, [typing, items, q, recent, popular]);

  const choose = (row: Row) => {
    if (row.kind === "suggestion") onSelect?.(row.item);
    else if (row.kind === "all") onSubmit(row.text);
    else {
      setQ(row.text);
      onSubmit(row.text);
    }
    setOpen(false);
  };

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 한글 조합 중
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % Math.max(rows.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? rows.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && rows[active]) choose(rows[active]);
      else if (q.trim()) {
        onSubmit(q.trim());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else setQ("");
    }
  }

  const showPanel = open && (rows.length > 0 || typing);
  const optionId = (i: number) => `${id}-opt-${i}`;
  const recentRows = rows.filter((r) => r.kind === "recent");
  const popularRows = rows.filter((r) => r.kind === "popular");
  // 함수로 그린다(컴포넌트로 만들면 렌더마다 다시 마운트됨). 순번은 rows의 순서와 같다.
  const option = (row: Row, key: string, children: ReactNode) => {
    const i = rows.indexOf(row);
    return (
      <li
        key={key}
        id={optionId(i)}
        role="option"
        aria-selected={active === i}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => choose(row)}
        onPointerMove={() => setActive(i)}
        className={cx(
          "flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-body-sm text-ink-2",
          "aria-selected:bg-surface-2 aria-selected:text-ink",
        )}
      >
        {children}
      </li>
    );
  };

  return (
    <div ref={rootRef} className={cx("relative w-full", className)}>
      <label htmlFor={`${id}-input`} className="sr-only">
        {label}
      </label>
      <div
        className={cx(
          "flex h-12 items-center gap-2.5 px-4 transition-[box-shadow,background-color] duration-150",
          "friendly:rounded-control friendly:bg-surface-2 friendly:ring-1 friendly:ring-inset friendly:ring-transparent friendly:not-focus-within:hover:ring-line-strong",
          "friendly:focus-within:bg-surface friendly:focus-within:ring-2 friendly:focus-within:ring-focus",
          "calm:border-b calm:border-line-strong calm:px-0 calm:focus-within:border-ink",
        )}
      >
        <IconSearch size={20} className="shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q ? (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            className="grid size-7 place-items-center rounded-full bg-ink-3/20 text-ink-2 hover:bg-ink-3/30"
          >
            <IconClose size={14} strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          className={cx(
            "absolute inset-x-0 top-full z-40 mt-1.5 max-h-[min(70dvh,480px)] overflow-y-auto rounded-control bg-surface p-2 shadow-raised",
            "ring-1 ring-line",
            "animate-fade-in",
          )}
        >
          <ul id={listId} role="listbox" aria-label={typing ? "추천 결과" : "검색어 제안"}>
            {typing ? (
              <>
                {loading && items.length === 0 ? (
                  <li className="px-3 py-2 text-label text-ink-3" aria-hidden>
                    찾는 중…
                  </li>
                ) : null}
                {!loading && items.length === 0 ? (
                  <li className="px-3 py-2 text-label text-ink-3">추천 결과가 없어요. 전체 검색은 할 수 있어요</li>
                ) : null}
                {rows.map((row) =>
                  row.kind === "suggestion" ? (
                    option(row, row.item.id, <>
                      <span className="w-10 shrink-0 overflow-hidden rounded-check">
                        {row.item.thumb ?? <ImagePlaceholder ratio="1/1" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm text-ink-2">
                          <Highlight text={row.item.title} query={q} />
                        </span>
                        {row.item.sub ? <span className="block truncate text-label text-ink-3">{row.item.sub}</span> : null}
                      </span>
                    </>)
                  ) : row.kind === "all" ? (
                    option(row, "all", <>
                      <IconSearch size={16} className="shrink-0 text-ink-3" />
                      <span className="flex-1">
                        ‘<span className="font-semibold text-ink">{row.text}</span>’ 전체 결과 보기
                      </span>
                      <IconArrowRight size={16} className="text-ink-3" />
                    </>)
                  ) : null,
                )}
              </>
            ) : (
              <>
                {recentRows.length ? (
                  <li role="presentation" className="flex items-center justify-between px-3 pt-1 pb-1.5">
                    <span className="text-label text-ink-3">최근 검색어</span>
                    {onClearRecent ? (
                      <button type="button" onClick={onClearRecent} className="text-label text-ink-3 underline-offset-4 hover:underline">
                        모두 지우기
                      </button>
                    ) : null}
                  </li>
                ) : null}
                {recentRows.map((row) =>
                  option(row, `r-${"text" in row ? row.text : ""}`, <>
                    <IconClock size={16} className="shrink-0 text-ink-3" />
                    {"text" in row ? row.text : null}
                  </>),
                )}
                {popularRows.length ? (
                  <li role="presentation" className="px-3 pt-3 pb-1.5 text-label text-ink-3">
                    많이 찾는 검색어
                  </li>
                ) : null}
                {popularRows.map((row, n) =>
                  option(row, `p-${"text" in row ? row.text : ""}`, <>
                    <span className="w-4 shrink-0 text-center text-label font-semibold text-ink">{n + 1}</span>
                    <span className="flex-1">{"text" in row ? row.text : null}</span>
                    {n < 2 ? <IconTrend size={14} className="text-ink-3" /> : null}
                  </>),
                )}
              </>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
