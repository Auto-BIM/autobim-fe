# 도면3D — 건축 평면도를 3D 모델로

DXF 평면도를 올리면 벽 레이어를 골라 높이만큼 세우고, 웹에서 돌려 본 뒤 GLB·OBJ·STL로 내려받는 졸업작품.
범용 풀스택 키트(`AGENTS.md` 등)와 디자인 플레이북(`design/`)으로 시작한 첫 시험 사이트다.

```
frontend/   React + three.js (Vite)          → Vercel
backend/    Python · FastAPI · RQ 작업 처리기 → 클라우드 (Docker)
design/     디자인 플레이북 (규칙·디자인 값·부품)
SITE_REQUEST.md  사이트 요청서 (목적·사용자·느낌·기능) — 결정 줄이 맨 아래
AGENTS.md        규칙집 (0장에 이 프로젝트 정보)
```

## 지금 되는 것 (v0.1, 2026-10-27)
- DXF 업로드 → 형식 검사(내용으로 판단, DWG는 안내) → 레이어·단위·크기 분석 → 2D 미리보기
- 벽 레이어 고르기(이름으로 추천), 벽 그리는 방식 자동 판별(두 줄 / 중심선), 높이·두께 설정
- 변환 작업을 대기열로(요청 안에서 변환하지 않음) → 진행 표시 → 3D 뷰어(시점 3개, 단면 높이)
- GLB(웹·Y위), OBJ(Y위), STL(Z위, 3D 프린팅) 내려받기, 결과 주소 `#job-<id>`로 7일 동안 다시 보기
- 이미지(PNG·JPG)는 받아서 위치 정보를 지우고 보관만 — 변환은 2단계 작업
- 시험: `backend/tests` 5개(업로드→변환→파일, DWG·가짜 파일 거절, 이미지 EXIF 제거, 잘못된 ID·레이어), 브라우저로 샘플 도면 끝까지 확인

## 실행 (로컬)

```bash
# 백엔드 — Docker 없이 (작업은 API 안 스레드에서)
cd backend
pip install -r requirements.txt
python -m app.sample                 # samples/ 시험 도면 2개 만들기
uvicorn app.main:app --reload        # http://localhost:8000/api/docs
python -m pytest -q tests

# 백엔드 — Docker로 (API + 작업 처리기 + Redis, 운영과 같은 구조)
docker compose up --build

# 프론트
cd frontend
npm install
npm run dev                          # http://localhost:5173 (/api는 8000으로 전달)
```

## 배포
| 부분 | 어디에 | 설정 |
|---|---|---|
| 프론트 | Vercel | 루트 디렉터리 `frontend`, 빌드 `npm run build`, 출력 `dist`. 환경 변수 `VITE_API_BASE=https://<백엔드 주소>` |
| API | 클라우드의 컨테이너 서비스 (예: Cloud Run, Render, Fly.io — 서울 근처 지역) | `backend/Dockerfile`. `ALLOWED_ORIGINS=https://<vercel 주소>`, `REDIS_URL` |
| 작업 처리기 | 같은 이미지, 명령만 `rq worker convert --url $REDIS_URL` | API와 **같은 파일 저장소**를 봐야 한다 → 아래 |
| Redis | 관리형 Redis(무료 단계) | — |
| 파일 저장소 | 지금은 디스크 폴더 | API와 작업 처리기가 다른 기계면 `backend/app/storage.py`를 오브젝트 스토리지(S3·GCS)로 바꾼다 — 다른 코드는 그대로 |
| 정리 | 하루 한 번 `python -m app.cleanup` (예약 작업) | 7일 지난 도면·결과 삭제 |

비밀 값은 없다(로그인·외부 API 없음). `backend/.env.example`에 설정 이름과 기본값만 있다.

## 2달 일정 (제안 — 마감 2026-12 말)
| 주 | 목표 | 완료 기준 |
|---|---|---|
| 1–2 | **실제 도면으로 검증** — 팀원·학과 DXF 10개 이상으로 시험, 실패 사례 모으기 | 10개 중 8개 이상이 고친 것 없이 3D로 나옴 |
| 3–4 | **창·문 높이** — 창 레이어는 창턱(0.9m)·창 윗부분(2.1m) 벽을 남기고, 문은 문 위 벽(2.1m~) 남기기 | 샘플에서 창 아래·위 벽이 보임 |
| 5 | **배포** — Vercel + 컨테이너 + 오브젝트 스토리지, 정리 예약 작업 | 외부에서 샘플 도면 끝까지 성공 |
| 6–7 | **이미지 입력(2단계)** — 선 찾기 → 그림 위에 겹쳐 보여주고 고치기 → 기준 길이 찍기 → 같은 변환 | 깨끗한 스캔 평면도 3개 성공 |
| 8 | **발표 준비** — 시연 도면 고정, 실패 화면 점검, 성능(큰 도면) 측정 | 시연 3번 연속 성공 |

## 키트 사용 기록 (키트를 키우는 재료)
- 풀스택 키트 `STACK_MAPPING.md`에 FastAPI 열이 없다 → 이 프로젝트에서 쓴 것: 업로드 크기 제한(직접 읽기), CORS, 보안 헤더 미들웨어, RQ 작업 대기열. 키트에 올릴 후보
- 새 규칙 후보 "오래 걸리는 작업은 요청 안에서 하지 않는다 — 대기열 + 상태 확인 + 진행 표시" (아직 겪지 않음 → (예))
- 디자인 플레이북에 새 부품 3개: `Dropzone`, `SpecList`(R19 라벨-값 표), `ProgressBar`. `SiteHeader`의 개발 모드 판별이 Next 전용이라 고침
- 버그 하나 겪음: React `useEffect`에서 값을 돌려주는 화살표 함수(`() => setCut(...)`)가 정리 함수로 오해돼 화면이 하얗게 됨 → 중괄호로 감쌈
