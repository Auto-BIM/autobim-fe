# Auto-BIM 프론트엔드

2D 평면도(이미지·DXF)를 올리면 벽·문·창이 **객체별로 나뉜 3D**와 **벽별 블록 .dxf**를 만들어 주는 Auto-BIM의 웹 화면이다.
인식이 확실하지 않은 요소는 임의로 고치지 않고 사용자에게 보여 주고, 사용자가 확인·수정하면 다시 만든다.

- 백엔드: 팀 저장소 [Auto-BIM/autobim-be](https://github.com/Auto-BIM/autobim-be) — **계약(API 약속서)은 그쪽 `docs/api.md`**
- 이 저장소: 프론트엔드만. 처음 보는 사람은 [`FRONTEND_GUIDE.md`](FRONTEND_GUIDE.md)부터 (코드가 어떻게 돌아가는지 설명)
- 규칙: `AGENTS.md`(풀스택 플레이북, 0장에 이 프로젝트 정보) · `design/`(디자인 플레이북) · `SITE_REQUEST.md`(요청서와 디자인 결정)

```
frontend/   React 19 + three.js + Tailwind 4 (Vite) → Vercel
design/     디자인 플레이북 (규칙·디자인 값·부품) — frontend가 @design으로 가져다 씀
```

## 지금 되는 것 (2026-10-28)

- **건물(여러 층) 3D** — `#sample`(샘플 3층) · `#b=…`(내 건물)
  - 층마다 도면을 따로 올려 쌓는다(백엔드는 도면 한 장 = 한 층). 층 순서·층고·계단·용도는 화면에서 넣고 주소(`#b=`)에 저장
  - 처음 한 번: 평면 선 → 기울기 → 층별로 바닥이 내려앉고 벽이 솟음 → 층이 펼쳐짐 (사용자 제작 hero 애니메이션을 Plan 데이터로 일반화)
  - 층을 누르면 그 층으로 다가가고(위층은 지우고 아래층은 흐리게), 벽·문·창·바닥·계단에 커서를 올리면 이름·치수
  - 보이기: 벽·문·창·바닥·계단 따로 켜고 끄기
  - 계단은 아직 인식되지 않아 **평면에서 끌어서 그린다**(단 수·오르는 방향)
  - **위험 검토**: 건물 용도(공동주택·단독주택·근린생활시설·기타)에 맞는 기준으로 검사 → 스캔 면이 지나가며 빨갛게 표시 + 설명 상자, 커서를 올리면 왜 위험한지·기준·근거. 법령 수치는 "법규", 실무 관례는 "통상 기준"으로 구분(`frontend/src/rules.ts`, 참고용 — 원문 확인 필요)

- 첫 화면(무대형): 샘플 3층 건물이 세워지고 펼쳐지는 애니메이션 1회 → 층에 올리면 들림·누르면 그 층으로, 화면 어디에 끌어다 놓아도 업로드. 설명은 메뉴(샘플 건물·사용법·소개)
- 업로드 → 작업 생성(`POST /api/jobs`) → 상태 따라가기(폴링) → 결과
- 작업 화면
  - **3D**: 서버가 만든 .glb. 벽(노드 이름 = 벽 ID)과 문·창을 눌러 고르기, 시점 3개, 단면 높이
  - **평면**: Plan(중심선 + 두께)을 SVG로. 고친 내용이 적용 전에 바로 보임(미리보기)
  - **확인 필요**(review_items) 목록 → 누르면 그 요소로
  - **속성 고치기**: 벽(종류·두께·높이), 문·창(종류·폭·높이·창대 높이·위치), 지우기, 벽 가운데에 문·창 추가, "맞아요, 확인했어요"
  - **실제 크기 맞추기**: 건물 가로 길이(m) 또는 벽 하나의 실제 길이
  - **바뀔 내용** 목록(하나씩 되돌리기) → "적용해서 다시 만들기" = `POST /supplement` 한 번 → 리비전 +1
  - 다시 만드는 동안 이전 결과를 계속 보여 줌, 실패하면 이유 + 이전 결과 유지
  - 받기: **.dxf(벽별 블록)** · .glb · .json (파일 이름에 리비전)
- 주소 `#job-<ID>`로 결과 다시 열기
- 오류 코드 → 한국어 안내(`src/api.ts`의 표)

확인: 팀 백엔드(Fake 모델)를 띄워 업로드 → 확인 → 수정 4가지 → 적용 → 리비전 1 → .dxf 받기 → 주소로 다시 열기, DXF 업로드(준비 중 안내), 잘못된 형식까지 브라우저로 끝까지 확인.

## 실행 (로컬)

```bash
# 1) 팀 백엔드 띄우기 (다른 터미널) — 자세한 건 autobim-be README
git clone https://github.com/Auto-BIM/autobim-be
cd autobim-be
python3.11 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.lock && pip install --no-deps -e .
uvicorn app.main:app --reload                            # http://localhost:8000/docs

# 2) 프론트
cd frontend
npm install
npm run dev                                              # http://localhost:5173 (/api는 8000으로 전달)
```

지금 백엔드 인식 모델은 **Fake**(어떤 그림을 올려도 같은 결과)라서, 화면 개발·시연 흐름 확인용이다.

## 배포

| 부분 | 어디에 | 설정 |
|---|---|---|
| 프론트 | Vercel | 루트 디렉터리 `frontend`, 빌드 `npm run build`, 출력 `dist`, 환경 변수 `VITE_API_BASE=https://<백엔드 주소>` |
| 백엔드 | 팀(autobim-be 이슈 #7) | **CORS에 프론트 주소를 넣어야 함** — 지금은 CORS 설정이 없어서 다른 주소의 프론트가 부르면 막힌다(로컬은 Vite가 대신 전달해서 괜찮음) |

## 백엔드 팀에 전할 것

- **(후속 제안, 지금 범위 밖) Plan에 공간(실) 추가 — AI Hub 데이터에 있는 것**
  - ⚠ 팀 결정 D-07(autobim-be `docs/project/DECISIONS.md`, 10월): 모델은 **4클래스(배경·벽·문·창)**, 인식 v1에서 계단은 제외. 그래서 이 항목은 시연 뒤(또는 P2) 이야기다. 지금은 계단을 사용자가 그리는 게 기본 경로
  - AI Hub 건축 도면 데이터에는 벽·문·창 말고도 **공간 12종**(거실·침실·주방·현관·발코니·화장실·실외기룸·드레스룸·다목적공간·엘리베이터홀·**계단실**·엘리베이터)이 세그멘테이션으로 들어 있다. 계단 한 단 한 단이 아니라 "계단실" 영역이다
  - 제안 모양(프론트 `api.ts`의 `Space`): `spaces: [{ id: "r1", type: "stair", polygon: [{x,y}…](mm), confidence }]` — `type` 키는 위 12종을 영어로(living, bedroom, kitchen, entrance, balcony, bathroom, outdoor_unit, dressroom, multipurpose, elevator_hall, stair, elevator)
  - 프론트는 이미 받을 준비가 돼 있다: 있으면 3D·평면에 실 이름을 붙이고, **계단실에서 계단 후보를 자동으로 만들어** 사용자에게 단 수·방향만 확인받는다. 없으면 지금처럼 사용자가 계단을 그린다
  - 계약 변경이라 백엔드 계약 PR로(`app/schemas/plan.py`, docs/api.md, openapi.json). 신뢰도가 낮은 공간은 review_items(`element_kind`에 "space" 추가 필요)
- **층**: 지금은 도면 한 장 = 한 층이라 프론트가 층을 쌓는다(층마다 작업 하나). 여러 층을 한 작업으로 다룰지는 팀 결정

- **CORS**: 배포한 프론트 주소(Vercel)를 허용 출처로 (이슈 #7)
- **업로드 크기 제한**: 정해지면 알려 주기 → `frontend/src/api.ts`의 `MAX_UPLOAD_MB`를 같은 값으로 (이슈 #4)
- **glb 법선**: 지금 glb에 법선(normal)이 없어서 프론트에서 계산한다. 넣어 주면 더 정확한 음영
- **review_items.message**가 영어 — 프론트는 `reason` 코드로 한국어를 보여 주고 message는 작게 덧붙인다. 한국어로 바꿔 주면 더 좋음
- 계약(docs/api.md)이 바뀌면 `frontend/src/api.ts` 타입부터 고친다

## 다음 할 일 (프론트)

1. 벽 추가(평면에서 두 점 찍기 → `add_walls`), 문·창 위치를 평면에서 끌어서 옮기기
2. 법규·기준 수치 안내(계획서 목표 3) — 기준 수치 표를 백엔드와 정해서 속성 패널에 근거로 표시
3. 실제 CubiCasa 모델이 붙으면(이슈 #5) 요소가 많은 도면으로 성능 점검(평면 SVG, 3D 고르기)
4. 원본 평면도 이미지를 평면 보기 뒤에 겹쳐 보기(인식이 맞는지 눈으로 비교) — 백엔드에 원본 이미지 주소 API가 필요
5. 배포(Vercel) + 백엔드 CORS 맞추기

## 기록

- 2026-10-27 처음엔 같은 저장소에 자체 백엔드(DXF 레이어 → 높이만큼 세우기)를 두고 시험했다(커밋 `09d50ec`). 팀 백엔드 계약이 있어 2026-10-28에 프론트만 남기고 계약에 맞춰 다시 짰다.
- 첫 화면·샘플 건물은 사용자가 만든 hero·defect 애니메이션의 평면 데이터를 Plan 모양으로 옮긴 것(`frontend/src/sampleBuilding.ts`). `public/sample/plan.png`는 "샘플로 해 보기" 업로드용 그림.
