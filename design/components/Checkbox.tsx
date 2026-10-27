"use client";
/**
 * Checkbox / ConsentGroup
 *
 * ConsentGroup 규칙 (회원가입·결제)
 * - "모두 동의"는 맨 위 한 줄, 아래 항목과 선으로 나눈다.
 * - 필수와 선택을 섞지 않는다. 필수 묶음 → 선택 묶음 순서.
 * - 선택 묶음 위에 "동의하지 않아도 가입할 수 있어요"를 적는다.
 * - 약관 본문은 "보기"로 따로 연다. 체크박스 글자 전체를 링크로 만들지 않는다.
 * - 선택 동의는 미리 체크해 두지 않는다.
 */
import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx } from "./cx";
import { IconCheck, IconChevronRight } from "./icons";

export function Checkbox({
  label,
  description,
  className,
  id: idProp,
  ...rest
}: Omit<ComponentPropsWithoutRef<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 inline-grid size-5 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          className={cx(
            "peer size-5 appearance-none rounded-check border-[1.5px] border-line-strong bg-surface",
            "transition-colors duration-150 checked:border-primary checked:bg-primary",
            "hover:border-ink-2 disabled:opacity-50",
          )}
          {...rest}
        />
        <IconCheck
          size={14}
          strokeWidth={2.5}
          className="pointer-events-none absolute text-primary-ink opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
        />
      </span>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer select-none">
        <span className="block text-body text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-label text-ink-3">{description}</span> : null}
      </label>
    </div>
  );
}

export type ConsentItem = { id: string; label: string; required: boolean; href?: string };

export function ConsentGroup({
  items,
  value,
  onChange,
  onOpenTerms,
}: {
  items: ConsentItem[];
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  /** "보기"를 눌렀을 때 (창으로 약관 열기) */
  onOpenTerms?: (item: ConsentItem) => void;
}) {
  const required = items.filter((i) => i.required);
  const optional = items.filter((i) => !i.required);
  const all = items.every((i) => value[i.id]);
  const setAll = (checked: boolean) => onChange(Object.fromEntries(items.map((i) => [i.id, checked])));

  // 컴포넌트가 아니라 함수로 그린다 (렌더마다 새 컴포넌트가 되면 포커스가 사라진다)
  const row = (item: ConsentItem) => (
    <li key={item.id} className="flex items-center justify-between gap-3 py-2">
      <Checkbox
        checked={Boolean(value[item.id])}
        onChange={(e) => onChange({ ...value, [item.id]: e.target.checked })}
        label={
          <>
            {/* 필수는 진한 테두리 표시 + 진한 글자, 선택은 흐린 글자 — 색이 아니라 진하기로 구분 */}
            <span
              className={cx(
                "mr-2 inline-flex h-5 items-center rounded-check px-1.5 align-[1px] text-label",
                item.required ? "font-semibold text-ink ring-1 ring-inset ring-ink" : "text-ink-3 ring-1 ring-inset ring-line",
              )}
            >
              {item.required ? "필수" : "선택"}
            </span>
            <span className={item.required ? "text-ink" : "text-ink-2"}>{item.label}</span>
          </>
        }
      />
      {item.href || onOpenTerms ? (
        <button
          type="button"
          onClick={() => onOpenTerms?.(item)}
          className="inline-flex shrink-0 items-center text-label text-ink-3 hover:text-ink"
          aria-label={`${item.label} 보기`}
        >
          보기
          <IconChevronRight size={14} />
        </button>
      ) : null}
    </li>
  );

  return (
    <fieldset className="w-full">
      <legend className="sr-only">약관 동의</legend>
      <div className="border-b border-line pb-3">
        <Checkbox
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
          label={<span className="font-semibold">모두 동의</span>}
          description="필수와 선택 항목을 한 번에 동의해요"
        />
      </div>
      <ul className="pt-2">
        {required.map(row)}
      </ul>
      {optional.length ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-label text-ink-3">동의하지 않아도 가입할 수 있어요</p>
          <ul className="pt-1">
            {optional.map(row)}
          </ul>
        </div>
      ) : null}
    </fieldset>
  );
}
