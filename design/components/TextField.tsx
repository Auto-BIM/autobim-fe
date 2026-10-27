"use client";
/**
 * TextField — 이름은 칸 위에, 예시는 칸 안(placeholder), 도움말·오류는 칸 아래.
 *   friendly : 연한 채움 상자형
 *   calm     : 밑줄형. 포커스하면 밑줄이 왼쪽→오른쪽으로 진해진다(사용자 행동에만 반응하는 움직임)
 *
 * 규칙
 * - placeholder는 이름이 아니라 "예: ..." 형태의 예시. 이름을 대신하지 않는다.
 * - 오류는 빨간 테두리만으로 알리지 않는다. 아이콘 + 고치는 방법 문장을 같이 쓴다.
 *   예) "이메일 형식이 아니에요. @를 포함해 입력해 주세요"
 * - 선택 입력이면 optional을 켠다 → 이름 옆에 "선택". 필수 표시(*)는 쓰지 않는다
 *   (필수가 기본이고, 예외인 선택만 표시한다).
 * - type="password"면 "비밀번호 보기" 버튼이 자동으로 붙는다 ("비밀번호 다시 입력" 칸 대신).
 */
import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx } from "./cx";
import { IconAlert, IconCheck, IconEye, IconEyeOff } from "./icons";

export type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  success?: string;
  optional?: boolean;
  /** 칸 안 오른쪽 끝 (단위 "원", 버튼 등) */
  trailing?: ReactNode;
  /** 이름을 화면에서 숨김 (검색칸처럼 맥락이 분명할 때만) */
  hideLabel?: boolean;
};

export const fieldFrame =
  "group/field relative flex items-center gap-2 h-12 transition-[box-shadow,background-color,border-color] duration-150 " +
  // friendly: 채움 상자
  "friendly:rounded-control friendly:bg-surface-2 friendly:px-4 friendly:ring-1 friendly:ring-inset friendly:ring-transparent " +
  "friendly:not-focus-within:hover:ring-line-strong friendly:focus-within:ring-2 friendly:focus-within:ring-focus friendly:focus-within:bg-surface " +
  // calm: 밑줄 + 포커스 시 차오르는 선
  "calm:border-b calm:border-line-strong calm:px-0 " +
  "calm:after:absolute calm:after:inset-x-0 calm:after:-bottom-px calm:after:h-0.5 calm:after:bg-focus " +
  "calm:after:origin-left calm:after:scale-x-0 calm:after:transition-transform calm:after:duration-200 calm:after:ease-standard " +
  "calm:focus-within:after:scale-x-100";

export const fieldInvalid =
  "friendly:ring-danger! calm:border-danger! calm:after:bg-danger!";

export const fieldInput =
  "peer min-w-0 flex-1 bg-transparent text-body text-ink outline-none focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:text-ink-3";

export function FieldLabel({
  htmlFor,
  children,
  optional,
  hidden,
}: {
  htmlFor: string;
  children: ReactNode;
  optional?: boolean;
  hidden?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cx(
        "mb-2 flex items-baseline gap-1.5 text-body-sm font-medium text-ink calm:text-label calm:text-ink-2",
        hidden && "sr-only",
      )}
    >
      {children}
      {optional ? <span className="text-label font-normal text-ink-3">선택</span> : null}
    </label>
  );
}

export function FieldMessage({ id, tone, children }: { id: string; tone: "hint" | "error" | "success"; children: ReactNode }) {
  return (
    <p
      id={id}
      className={cx(
        "mt-2 flex items-start gap-1.5 text-label",
        tone === "hint" && "text-ink-3",
        tone === "error" && "text-danger",
        tone === "success" && "text-success",
      )}
    >
      {tone === "error" ? <IconAlert size={15} className="mt-px shrink-0" /> : null}
      {tone === "success" ? <IconCheck size={15} className="mt-px shrink-0" /> : null}
      <span>{children}</span>
    </p>
  );
}

export function TextField({
  label,
  hint,
  error,
  success,
  optional,
  trailing,
  hideLabel,
  type = "text",
  id: idProp,
  className,
  ...rest
}: TextFieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const msgId = `${id}-msg`;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const message = error ?? success ?? hint;
  const tone = error ? "error" : success ? "success" : "hint";

  return (
    <div className={cx("w-full min-w-0", className)}>
      <FieldLabel htmlFor={id} optional={optional} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <div className={cx(fieldFrame, error && fieldInvalid)}>
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? msgId : undefined}
          className={fieldInput}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            aria-label={reveal ? "비밀번호 숨기기" : "비밀번호 보기"}
            className="-mr-2 grid size-9 place-items-center rounded-control text-ink-3 hover:text-ink calm:mr-0"
          >
            {reveal ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        ) : null}
        {trailing}
      </div>
      {message ? (
        <FieldMessage id={msgId} tone={tone}>
          {message}
        </FieldMessage>
      ) : null}
    </div>
  );
}
