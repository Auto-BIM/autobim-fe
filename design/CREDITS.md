# CREDITS — 외부 자원과 라이선스

| 자원 | 쓰는 곳 | 라이선스 |
|---|---|---|
| Pretendard (orioncactus) | 기본 글꼴 | SIL Open Font License 1.1 |
| Noto Serif KR (Google) | calm 프리셋 제목 글꼴 | SIL Open Font License 1.1 |
| Tailwind CSS 4 | 스타일 도구 | MIT |
| React | 부품 | MIT |
| esbuild | 평가판 빌드 | MIT |
| Cormorant Garamond (Christian Thalmann) | v0.2 house 워드마크·큰 숫자 | SIL Open Font License 1.1 |
| Instrument Serif (Instrument) | v0.2 editorial 제목·인용 | SIL Open Font License 1.1 |
| Inter Tight (Rasmus Andersson 외) | v0.2 영문 대문자 라벨, object 제목 | SIL Open Font License 1.1 |
| three.js | v0.2 시안 소재 렌더 (`scripts/render-stills/`) | MIT |
| Playwright | v0.2 렌더·캡처 실행 | Apache 2.0 |
| axe-core (Deque) | v0.2 캡처 단계의 접근성 자동 검사 (개발 도구, 사이트에 포함되지 않음) | MPL 2.0 |

- 아이콘(`design/components/icons.tsx`): 이 플레이북에서 직접 그린 단순 도형. 외부 아이콘 세트에서 복사하지 않음.
- 이미지: 부품 평가판은 `ImagePlaceholder`. v0.2 완성본 예시의 사진은 `scripts/render-stills/`로 직접 렌더한 것(외부 모델·텍스처·HDRI 없음) — `examples/house-restaurant/public/stills/CREDITS.md`.
- 예시 문구·상품명·가게(여울): 평가판과 예시를 위해 새로 지어냄.

사이트를 만들 때 추가하는 이미지·글꼴·라이브러리는 이 표에 출처와 라이선스를 적는다.

## 이 사이트(Auto-BIM 프론트)가 실제로 내보내는 것

방문자 브라우저로 파일이 그대로 나가므로 재배포다(풀스택 9장). 라이선스 전문은 빌드 때 `frontend/scripts/licenses.mjs`가 node_modules에서 모아 `frontend/public/licenses/THIRD_PARTY_LICENSES.txt`로 만들고, 사이트 아래쪽 "글꼴·라이브러리 라이선스" 링크로 연결한다(압축하면 코드 안의 `@license` 주석이 빠지기 때문).

| 자원 | 받는 곳(npm) | 쓰는 곳 | 라이선스 |
|---|---|---|---|
| Pretendard 1.3.9 (Kil Hyung-jin) | `pretendard` — 동적 서브셋 | 본문·UI 글꼴 | SIL OFL 1.1 (예약 글꼴 이름 "Pretendard" — 고친 글꼴을 이 이름으로 배포하지 않는다) |
| Noto Serif KR (Google) | `@fontsource/noto-serif-kr` 400 | 한글 제목(calm 프리셋) | SIL OFL 1.1 |
| Instrument Serif (Instrument) | `@fontsource/instrument-serif` latin 400 | 영문·숫자 제목(editorial 디렉션) — 파일 이름·층 이름 | SIL OFL 1.1 |
| Inter Tight (The Inter Project Authors) | `@fontsource-variable/inter-tight` | 영문 대문자 작은 라벨(`micro-label`) | SIL OFL 1.1 |
| three.js 0.180 | `three` | 3D 보기(작업 화면 glb, 건물 화면, 첫 화면 모형) | MIT |
| React 19 · scheduler | `react`, `react-dom` | 화면 | MIT |

- 글꼴은 모두 우리 서버(Vercel)에서 같이 내보낸다(외부 글꼴 CDN을 부르지 않음). 글꼴 파일을 고치지 않는다.
- 3D 모형·평면 데이터: 첫 화면·샘플 건물은 사용자가 직접 만든 애니메이션의 평면 데이터(`frontend/src/sampleBuilding.ts`). 외부 3D 모델·텍스처 없음.
- `frontend/public/sample/plan.png`("샘플로 해 보기" 업로드용 단순 평면도, 커밋 `59046a3`에서 추가): 출처 기록이 없어 **확인 필요** — 직접 그린 것이면 이 줄에 그렇게 적고, 외부 도면이면 출처·라이선스를 적거나 직접 그린 것으로 바꾼다.
- 위험 검토 기준 수치(`frontend/src/rules.ts`)는 법령 수치를 참고로 옮긴 것 — 화면에 "참고용, 원문 확인"을 적는다(법령 본문을 복사하지 않음).
- 인식 모델(CubiCasa5K, 비상업 라이선스)은 팀 백엔드 쪽 — 이 저장소에는 없다. 소개 화면에 라이선스 종류를 적어 두었다.

