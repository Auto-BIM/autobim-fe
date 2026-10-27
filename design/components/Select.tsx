"use client";
/**
 * Select — 브라우저 기본 select에 모양만 입힌다 (모바일에서 OS 선택기가 열려 편하다).
 * 정렬처럼 옵션이 2~7개면 이걸 쓰고, 8개 이상이거나 검색이 필요하면 SearchBox를 쓴다.
 * variant="bare"는 결과 위 정렬처럼 칸 없이 글자만 보이는 형태.
 */
import { useId, type ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";
import { FieldLabel, FieldMessage, fieldFrame, fieldInvalid } from "./TextField";
import { IconChevronDown } from "./icons";

type Option = { value: string; label: string };

export function Select({
  label,
  options,
  hint,
  error,
  optional,
  hideLabel,
  variant = "field",
  id: idProp,
  className,
  ...rest
}: Omit<ComponentPropsWithoutRef<"select">, "children"> & {
  label: string;
  options: Option[];
  hint?: string;
  error?: string;
  optional?: boolean;
  hideLabel?: boolean;
  variant?: "field" | "bare";
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const msgId = `${id}-msg`;

  if (variant === "bare") {
    return (
      <span className={cx("relative inline-flex items-center", className)}>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <select
          id={id}
          style={{ colorScheme: "inherit" }}
          className="h-9 appearance-none bg-transparent pr-6 pl-1 text-body-sm font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-focus"
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface text-ink">
              {o.label}
            </option>
          ))}
        </select>
        <IconChevronDown size={16} className="pointer-events-none absolute right-0 text-ink-2" />
      </span>
    );
  }

  return (
    <div className={cx("w-full min-w-0", className)}>
      <FieldLabel htmlFor={id} optional={optional} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <div className={cx(fieldFrame, error && fieldInvalid)}>
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          style={{ colorScheme: "inherit" }}
          className="h-full min-w-0 flex-1 appearance-none bg-transparent pr-8 text-body text-ink outline-none"
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface text-ink">
              {o.label}
            </option>
          ))}
        </select>
        <IconChevronDown size={18} className="pointer-events-none absolute right-3 text-ink-2 calm:right-0" />
      </div>
      {error || hint ? (
        <FieldMessage id={msgId} tone={error ? "error" : "hint"}>
          {error ?? hint}
        </FieldMessage>
      ) : null}
    </div>
  );
}
