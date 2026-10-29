---
name: design-review
description: 만든 화면이 디자인 플레이북(design/DESIGN.md 13장 점검표 C1~C24, 13.1 품질 기준표 Q1~Q5)과 저작권 규칙을 지키는지 검사한다. 화면을 완성했을 때, 또는 "디자인 검사해줘"라고 할 때 쓴다.
---

# design-review — 완성 점검

결과는 **통과 / 실패 / 해당 없음**을 항목별로 표로 내고, 실패마다 파일·줄·고칠 방법을 적는다. 점수로 뭉뚱그리지 않는다.

## 1. 자동 검사 (먼저)
검사 대상 = 이번에 바꾼 페이지·부품 파일.

**v0.2: 한 줄로 돌린다** — 아래 grep들을 묶은 스크립트. 실패가 있으면 종료 코드 1.
```bash
node scripts/design-lint.mjs app            # C4·C8·C9·C10·C18·C20·C23 (+ CREDITS 없는 소재)
node scripts/design-lint.mjs app --release  # 출시·납품 전: 시안 소재·ImagePlaceholder가 남으면 실패 (C22)
node scripts/design-lint.mjs app --dist out # 빌드 결과의 글꼴 파일 옆에 라이선스가 있는지
node scripts/check-contrast.mjs design/tokens.css app/site-theme.css   # C11
```
스크립트가 못 잡는 경우를 위해 원래 grep도 남겨 둔다:

```bash
# C8 날것의 값: 임의 px, hex, rgb, Tailwind 기본 팔레트
grep -nE "\[[0-9.]+px\]|#[0-9a-fA-F]{3,8}\b|rgb\(|(text|bg|border|ring)-(red|blue|gray|neutral|zinc|slate|black|white)(-[0-9]+)?(/[0-9]+)?\b" <파일들>

# C10 12px 미만 글자
grep -nE "text-\[(9|10|11)(\.[0-9]+)?px\]|text-\[0\.(5|6)[0-9]*rem\]" <파일들>

# C11 대비
node scripts/check-contrast.mjs design/tokens.css app/site-theme.css

# C4 primary 버튼 후보 (variant를 안 쓴 <Button>도 primary다) → 화면당 1개인지 눈으로 확인
grep -nE "<Button\b" <페이지 파일> | grep -vE 'variant="(secondary|text|danger)"'

# C18 반말·습니다체 섞임
grep -nE "(합니다|입니다|하십시오|해라|했다)[.\"'<]" <파일들>

# C20 외부 자산
grep -nE "https?://[^\"' ]+\.(png|jpe?g|webp|gif|svg|mp4|woff2?)" <파일들>

# C23 (v0.2) 한글에 micro-label을 쓴 곳 — 결과를 눈으로 확인 (영문 대문자만 허용)
grep -nE 'micro-label[^>]*>[^<]*[가-힣]' <페이지 파일>

# C22 (v0.2) 시안 소재가 남아 있는지 (납품 점검 때)
grep -rn "납품 전 교체" public/images/CREDITS.md public/**/CREDITS.md 2>/dev/null
```
- 부품 파일(`design/components`) 안의 임의 값은 머리말에 이유가 있으면 통과.

## 2. 눈으로 검사 (캡처 필수)
`node scripts/shoot.mjs <페이지> .tmp/shots` (움직임 줄이기 확인: `--reduced-motion`을 붙여 한 번 더). 375·1440 첫 화면과 전체 캡처를 **직접 열어 본다.** 캡처 없이 통과를 주지 않는다.
같은 실행에서 axe-core 접근성 자동 검사(WCAG 2.1 A·AA)가 돈다 — 위반은 실패로 보고 고친다. "확인 필요"(사진 위 글자 대비 등)는 캡처를 보고 판단한다.

| 항목 | 보는 법 |
|---|---|
| C1 3초 목적 | 첫 화면 캡처만 보고 "무슨 사이트·무엇을 하면 되는지" 한 문장으로 말해 본다. 못 하면 실패 |
| C2 주인공 | 첫 화면에서 가장 큰 덩어리가 실제 내용물(작업·상품·화면)인가 |
| C3 문구 | 큰 문장에서 회사 이름을 다른 회사로 바꿔도 말이 되면 실패 |
| C4~C7 위계 | 1등이 하나인가, 층 3개 이하, 옆 단 1개 이하, 메뉴 ≤5, 같은 카드 형식, 같은 버튼 반복 없음 |
| C9 강조색 | 강조색이 보이는 곳을 모두 세고, 의미가 하나인지 |
| C12~C15 반응 | hover·포커스·누름·잠김(이유)·빈 화면·스켈레톤이 있는지 (Tab 키로 한 바퀴) |
| C16~C17 모바일 | 375에서 가로 스크롤, 겹침, 44px 미만 누름 영역 |
| C19 | 키보드만으로 주 행동 끝까지 가능, reduced-motion 에뮬레이션에서 움직임 꺼짐 |

## 2.5 품질 기준표 (v0.2 — DESIGN.md 13.1)
캡처를 보고 Q1~Q5를 1~5점으로 매기고 **근거를 한 줄씩** 적는다. 디렉션 사이트는 같은 디렉션의 완성본 예시 캡처(`examples/*/shots/`)와 나란히 놓고 매긴다.
- 3점 미만 항목 → 고쳐서 다시 캡처 (최대 3번). 3번 뒤에도 미달이면 원인(소재 부족 등)과 함께 보고한다.
- 자주 나오는 원인과 처방:

| 증상 | 처방 |
|---|---|
| 중간 크기 글자가 많다 (Q1) | 섹션 제목만 남기고 나머지를 body·micro로 내린다. 큰 한 줄을 한 단계 키운다 |
| 섹션 간격이 다 같다 (Q2) | 섹션 사이 96~144, 묶음 안 16~24로 차이를 벌린다 |
| 시작선이 섹션마다 다르다 (Q3) | 모든 섹션을 같은 container + 12열 시작선(1·6·7열)에 맞춘다 |
| 회색 상자가 보인다 (Q4) | 시안 소재 렌더로 바꾼다. 사진끼리 색감이 다르면 grade.py로 통일 |
| 모든 상자에 둥근 모서리·그림자 (Q5) | 디렉션 값으로 되돌린다(house·editorial은 0·그림자 없음), 선은 1px |

## 3. 저작권·독창성 (C20) — 4문항 모두 "예"여야 통과
1. 이 화면에서 특정 사이트 하나가 떠오르지 않는다
2. brief "참고한 느낌"의 사이트와 색·배치·문구가 겹치지 않는다 (참고 링크가 있으면 실제로 나란히 비교)
3. 모든 이미지·아이콘·글꼴·문구의 출처를 말할 수 있다 → `public/images/CREDITS.md`
4. 강조색이 유명 서비스의 대표 색과 구분된다

## 4. 보고 형식
```
## 디자인 점검 — <페이지>
결정: preset=… mode=… accent=…
| # | 결과 | 근거 / 고칠 곳 |
|---|---|---|
| C1 | 통과 | … |
| C8 | 실패 | app/page.tsx:42 `text-[11px]` → `text-label` |
...
### 품질 기준표
| Q | 점수 | 근거 |
|---|---|---|
| Q1 크기 대비 | 4 | … |
...
실패 n개 · 3점 미만 n개 → 고친 뒤 다시 캡처·점검 (n번째)
```
반복해서 나오는 실패는 `design/LOG.md`에 원인 분류와 함께 적는다.
