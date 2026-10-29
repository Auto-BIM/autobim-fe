# typography.md — 글자 규칙 (v0.2)

> 세련됨의 절반은 글자에서 나온다. 이 문서는 **글꼴 짝**과 **세부 값**을 정한다.
> 크기 단계는 DESIGN.md 2.2, 값은 `tokens.css`.

## 1. 글꼴 짝 (모두 SIL Open Font License 1.1 — 상업 사용·웹 임베드 가능, 글꼴 파일 판매 금지)

| 역할 | house | editorial | object | 프리셋만 (calm / friendly) |
|---|---|---|---|---|
| 워드마크·큰 숫자 | Cormorant Garamond 500 | Instrument Serif | Inter Tight 600 | — |
| 한글 제목 | Noto Serif KR 500~600 | Noto Serif KR 500 | Pretendard 700 | Noto Serif KR / Pretendard |
| 영문 대문자 라벨 | Inter Tight 500 | Inter Tight 500 | Inter Tight 500 | (eyebrow 13px) |
| 본문 | Pretendard 400 | Pretendard 400 | Pretendard 400 | Pretendard 400 |

- 한 사이트의 글꼴은 **최대 3가족**(워드마크용 세리프 + 한글 제목 + 본문/라벨). 4가족 이상 금지.
- 새 글꼴을 들일 때는 라이선스(OFL·Apache 등 웹 임베드 허용)를 `CREDITS.md`에 적는다. 유료·상업 불가 글꼴, 출처를 모르는 "무료 글꼴 모음" 파일은 쓰지 않는다.
- Next.js에서는 `next/font`로 불러온다(버전별 문서 확인 — AGENTS.md). 한글 글꼴은 반드시 부분 집합(subset) 또는 동적 분할 파일을 쓴다.

## 2. 영문 라벨 + 한글 본문 섞기

한국 사이트에서 가장 쉽게 세련돼 보이는 조합이다. 단, 규칙이 있다.

1. 영문 대문자 라벨은 **꾸밈 + 분류**에만 쓴다: `MENU`, `THE ROOM`, `VISIT`, `SEASON 03`. 바로 옆이나 아래에 한글 제목이 반드시 있어야 한다 (영문만 읽어서는 뜻을 몰라도 쓸 수 있어야 함).
   - 주 메뉴(내비게이션)는 영문 라벨 3~4개까지 허용한다. 단, 눌러서 도착한 섹션의 제목은 한글이어야 한다.
2. 버튼·오류·안내 같은 **해야 할 일을 알려주는 글자는 한글**로 쓴다. "RESERVE" 버튼 금지 → "자리 예약하기".
3. 영문 라벨은 `micro-label`(11px, 자간 0.16em, 대문자). **한글에는 11px도, 대문자 자간도 쓰지 않는다.** 한글 작은 글자는 `eyebrow`(13px) 또는 `label`(13px).
4. 영문 워드마크(가게 이름)는 세리프 + 자간 0.04em. 한글 이름이 있으면 바로 아래 `label` 크기로 함께.

## 3. 세부 값 — "초보처럼 보이지 않게" 하는 것들

| 항목 | 규칙 |
|---|---|
| 큰 제목 자간 | `display` 이상 −0.025em, `display-xl` 한글 명조 −0.03em. 영문 세리프는 −0.01em |
| 큰 제목 줄 간격 | `display-xl` 1.02~1.08. 줄바꿈은 `<br>`가 아니라 `text-wrap: balance` + 의미 단위로 문장 쓰기 |
| 숫자 | 가격·시간·전화·별점은 `numerals`(고정폭 숫자). 가격 표기 `32,000` + 작은 "원" 또는 단위 생략은 사이트 전체 통일. ID·코드(`o3`, `w12`, 주문 번호)는 제목 글꼴에 넣지 않는다 — 세리프의 옛 숫자꼴에서 `o3`이 `03`처럼 읽힌다. 종류는 제목 글꼴, ID는 본문 글꼴 고정폭(Auto-BIM 2026-10-30) |
| 라벨-값 목록 | 라벨 `micro-label` ink-3, 값 `body-sm`~`body` ink. 줄마다 위에 1px 선. 값은 오른쪽 정렬(크레딧형) 또는 왼쪽 정렬(정보형) 중 하나로 통일 |
| 선 | 1px, `line` 색. 2px 이상 선은 강조가 아니라 무게가 된다 → 쓰지 않는다 |
| 정렬 | 한 섹션 안의 글자 시작선은 하나. 가운데 정렬은 짧은 인용·한 줄 제목만 |
| 굵기 | 세리프 제목은 500~600. 700 이상의 명조는 둔해 보인다 |
| 대문자 영문 | 짧게(1~3단어). 문장 전체를 대문자로 쓰지 않는다 (인용 제외) |
| 문단 폭 | 한글 본문 한 줄 32~40자. 반 화면 글 단(EditorialSplit)은 최대 520px |

## 4. 크기 대비 — 디렉션별 사용 단계

| 디렉션 | 쓰는 단계 (한 화면 최대 5개) |
|---|---|
| house | micro · body-sm · body · title-lg · display-xl |
| editorial | micro · body-sm · title · display-sm · display-lg |
| object | micro · label · body-sm · body · title |
| 프리셋만 | DESIGN.md 2.2 그대로 |

중간 크기를 많이 쓸수록 밋밋해진다. **작은 것은 확실히 작게, 큰 것은 확실히 크게.**
