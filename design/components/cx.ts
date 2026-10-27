/** 클래스 이름 합치기 (false/undefined는 건너뜀). 외부 라이브러리 없이 쓴다. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
