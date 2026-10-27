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

- 첫 화면: 샘플 평면도 3D 모형(끌어서 돌리기, 눌러서 들여다보기, 처음 1회 벽이 솟아오름) + 업로드
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
- 첫 화면 샘플 모형(`frontend/public/sample/`)은 그때 만든 우리 샘플 도면을 변환해 둔 정적 파일이다. 만든 스크립트는 `09d50ec`의 `backend/app/hero_sample.py`.
