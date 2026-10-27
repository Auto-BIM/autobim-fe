"use client";
/**
 * ResultBar — 목록 결과 바로 위 한 줄: 왼쪽 결과 개수, 오른쪽 정렬.
 * 켜 둔 필터가 있으면 그 아래 한 줄에 칩으로 보여주고 하나씩 끌 수 있게 한다 + "모두 해제".
 */
import type { ReactNode } from "react";
import { Select } from "./Select";
import { IconClose } from "./icons";

export function ResultBar({
  total,
  unit = "개",
  sort,
  sortOptions,
  onSortChange,
  activeFilters = [],
  onRemoveFilter,
  onClearFilters,
  extra,
}: {
  total: number;
  unit?: string;
  sort: string;
  sortOptions: { value: string; label: string }[];
  onSortChange: (v: string) => void;
  activeFilters?: { id: string; label: string }[];
  onRemoveFilter?: (id: string) => void;
  onClearFilters?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="border-b border-line pb-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-body-sm text-ink-2" aria-live="polite">
          총 <strong className="font-semibold text-ink">{total.toLocaleString("ko-KR")}</strong>
          {unit}
        </p>
        <div className="flex items-center gap-2">
          {extra}
          <Select variant="bare" label="정렬" value={sort} onChange={(e) => onSortChange(e.target.value)} options={sortOptions} />
        </div>
      </div>
      {activeFilters.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onRemoveFilter?.(f.id)}
              className="inline-flex h-8 items-center gap-1 rounded-chip bg-surface-2 pr-2 pl-3 text-label text-ink hover:bg-line"
              aria-label={`${f.label} 필터 해제`}
            >
              {f.label}
              <IconClose size={14} />
            </button>
          ))}
          {onClearFilters ? (
            <button type="button" onClick={onClearFilters} className="ml-1 text-label text-ink-3 underline-offset-4 hover:underline">
              모두 해제
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
