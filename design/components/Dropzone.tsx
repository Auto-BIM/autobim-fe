"use client";
/**
 * Dropzone — 파일 올리기 영역. 끌어다 놓기 + 눌러서 고르기(키보드로도).
 *
 * 규칙
 * - 받는 형식과 크기 한도를 영역 안에 적는다 ("DXF · PNG · JPG, 20MB까지").
 * - 끌어다 놓는 중에는 테두리·바탕이 진해진다. 혼자 움직이는 장식은 없다.
 * - 올리는 중(busy)에는 진행 문장을 보여주고 다시 누를 수 없다.
 * - 오류는 영역 아래에 아이콘 + 고치는 방법 문장 (TextField와 같은 방식).
 * - 형식 검사는 서버가 다시 한다(풀스택 15장). 여기서는 안내만.
 */
import { useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { FieldMessage } from "./TextField";
import { Button } from "./Button";

export function Dropzone({
  onFile,
  accept,
  title,
  hint,
  busy = false,
  busyText = "올리는 중…",
  error,
  icon,
  className,
}: {
  onFile: (file: File) => void;
  accept?: string;
  title: ReactNode;
  hint: ReactNode;
  busy?: boolean;
  busyText?: string;
  error?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) onFile(f);
        }}
        className={cx(
          "relative flex min-h-56 flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors duration-150",
          "rounded-card border-line-strong bg-surface",
          over && "border-solid border-ink bg-surface-2",
          error && "border-danger",
        )}
      >
        {icon ? <span className="text-ink-3">{icon}</span> : null}
        <p className="text-title-sm font-semibold text-ink">{busy ? busyText : title}</p>
        <p className="text-body-sm text-ink-3">{hint}</p>
        <Button className="mt-2" loading={busy} aria-describedby={error ? `${id}-err` : undefined} onClick={() => input.current?.click()}>
          파일 고르기
        </Button>
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error ? (
        <FieldMessage id={`${id}-err`} tone="error">
          {error}
        </FieldMessage>
      ) : null}
    </div>
  );
}
