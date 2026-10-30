# 스택별 대응표

`AGENTS.md`의 원칙이 각 스택에서 무엇에 해당하는지 정리한 출발점이다.
이름·옵션은 버전마다 바뀌므로 실제로 쓰기 전에 그 프로젝트에 설치된 버전의 공식 문서로 확인한다.
쓰지 않는 스택의 줄은 지워도 된다.

| 열 | 검증 상태 | 기준 버전 · 확인한 날 |
|---|---|---|
| Next.js · Vercel | **운영에서 쓴 스택**(STILL THEATER) — 칸마다 다 써 본 것은 아님 | Next.js 16.3 · 2026-10 |
| FastAPI (Python) | 일부 사용(도면3D, 맨 아래 "FastAPI 메모") | FastAPI 0.162 · 2026-10 |
| Node · Django · Rails · Spring Boot | 미검증 — 문서 기준 출발점 | 쓰게 되면 여기에 버전과 날짜를 적는다 |
| 스택 무관 (CDN · DB · 인프라) | 일부 검증(Postgres·Vercel CDN) | 2026-10 |

> 직접 써서 확인한 칸은 끝에 `(검증)`을 붙인다. 버전이 올라가면 이 표의 날짜부터 고친다.

## 캐시·렌더링

### 1. 공용 캐시 — 같은 화면은 한 번 만들어 재사용

- **Next.js · Vercel**: ISR `export const revalidate`, 공용 경로 `dynamic = "force-static"`, 데이터는 `unstable_cache`(또는 `"use cache"`)
- **Node (Express · NestJS)**: `Cache-Control: public, s-maxage=…` 직접 지정, Nest `CacheInterceptor`, Redis
- **Django**: `cache_page`, `cache_control(public=True, s_maxage=…)`, 저수준 `cache.get`/`cache.set`
- **Rails**: `expires_in …, public: true`, `fresh_when`/`stale?`(ETag), `Rails.cache.fetch`, fragment cache
- **Spring Boot**: `@Cacheable`(Caffeine·Redis), `ResponseEntity…cacheControl(CacheControl.maxAge(…).cachePublic())`
- **스택 무관 (CDN · DB · 인프라)**: CDN(Cloudflare·CloudFront·Fastly)이 `s-maxage`를 따르는지, 캐시 키에 무엇이 들어가는지 확인

### 2. 비로그인 / 로그인 분리 — 세션 쿠키가 없을 때만 공용 캐시

- **Next.js · Vercel**: `next.config` rewrites의 `missing: [{ type: "cookie" }]`로 공용 경로 분리, 공용 경로에서 `cookies()`·`headers()`·세션 읽기 금지
- **Node (Express · NestJS)**: `express-session`은 `saveUninitialized: false`(비로그인에게 쿠키 안 만들기), 공용 라우트에는 세션 미들웨어를 걸지 않기
- **Django**: 레이아웃에서 `request.user`를 읽으면 세션 접근 → `Vary: Cookie`가 붙는다. 공용 화면은 세션을 건드리지 않는 템플릿
- **Rails**: 레이아웃의 `current_user`·`csrf_meta_tags` 등이 세션 쿠키를 만들 수 있다. 공용 화면은 세션을 건드리지 않게
- **Spring Boot**: Spring Security는 기본으로 응답에 `no-cache, no-store` 계열 헤더를 붙인다. 공용 응답은 `CacheControl`을 직접 지정하고 헤더를 확인
- **스택 무관 (CDN · DB · 인프라)**: CDN 규칙 "세션 쿠키가 있으면 캐시 우회(bypass)", 캐시 키에서 쿠키 제외

### 3. 개인 응답은 공유 캐시 금지

- **Next.js · Vercel**: 로그인 경로는 요청마다 렌더, 응답 헤더가 `private, no-store`인지 확인
- **Node (Express · NestJS)**: `res.set("Cache-Control", "private, no-store")`
- **Django**: `never_cache`, `cache_control(private=True, no_store=True)`
- **Rails**: `no_store`(7.0+) 또는 `Cache-Control` 직접 지정
- **Spring Boot**: Spring Security 기본 헤더(no-store) 유지
- **스택 무관 (CDN · DB · 인프라)**: CDN에서 `Set-Cookie`가 있는 응답은 캐시하지 않게

### 4. 실패·빈 결과는 캐시하지 않기

- **Next.js · Vercel**: `unstable_cache` 안에서 실패는 throw(저장되지 않음). 외부 API를 fetch 캐시(`next.revalidate`)로 통째로 캐시하지 않기
- **Node (Express · NestJS)**: 성공했을 때만 `cache.set`, 실패한 Promise는 캐시 맵에서 지우기
- **Django**: 성공일 때만 `cache.set`. `cache_page`는 200만 저장하지만 CDN은 404도 캐시할 수 있다
- **Rails**: `Rails.cache.fetch(key, skip_nil: true)`, 실패는 raise(블록이 끝나지 않으면 저장 안 됨)
- **Spring Boot**: `@Cacheable(unless = "#result == null")`, 실패는 예외(예외는 캐시되지 않음)
- **스택 무관 (CDN · DB · 인프라)**: CDN의 오류 응답 캐시(negative caching) 시간 확인

### 5. 좁은 캐시 무효화

- **Next.js · Vercel**: 바뀐 화면의 `revalidatePath(구체 경로)`·태그 무효화. 루트 레이아웃 전체 무효화 금지
- **Node (Express · NestJS)**: 키 단위 `cache.del`, 태그별 키 목록
- **Django**: `cache.delete(key)`, 키에 버전 값
- **Rails**: 키 기반 만료(`cache_key_with_version`, `touch: true`)
- **Spring Boot**: `@CacheEvict(key = …)`, `allEntries = true` 피하기
- **스택 무관 (CDN · DB · 인프라)**: CDN purge는 URL·태그 단위(전체 purge 피하기)

### 6. 첫 응답 HTML에 핵심 내용, 느린 부분은 나중에

- **Next.js · Vercel**: 서버 컴포넌트로 본문 렌더 + `<Suspense>` 스트리밍. 화면 전체를 `loading.tsx`로 감싸지 않기
- **Node (Express · NestJS)**: 서버 렌더 템플릿 + 느린 부분은 별도 API·지연 로딩
- **Django**: 템플릿에 본문, 느린 부분은 htmx·비동기 요청
- **Rails**: 본문은 뷰에, 느린 부분은 Turbo Frame `loading: :lazy`
- **Spring Boot**: Thymeleaf 본문 + 느린 부분 비동기 요청
- **스택 무관 (CDN · DB · 인프라)**: 검색 엔진·공유 미리보기가 읽는 것은 첫 HTML

## 데이터베이스

### 7. 필요한 열만 읽기

- **Next.js · Vercel**: Prisma `select`(목록에서 `include` 남용 금지), Drizzle 열 지정
- **Node (Express · NestJS)**: Prisma `select`, TypeORM `select`, Knex `.select(열…)`
- **Django**: `.only()`, `.defer()`, `.values()`/`.values_list()`
- **Rails**: `select(:id, :title)`, `pluck`
- **Spring Boot**: JPA 프로젝션(인터페이스·DTO), `select new …`
- **스택 무관 (CDN · DB · 인프라)**: 큰 열(본문·JSON·바이너리)은 상세 화면에서만

### 8. 거르기·정렬·집계는 DB 안에서, JSON은 필요한 부분만

- **Next.js · Vercel**: Prisma `where`·`orderBy`·`take`, 복잡하면 `$queryRaw`(`Prisma.sql` 바인딩)
- **Node (Express · NestJS)**: ORM 조건·`groupBy`, 복잡하면 바인딩한 원시 SQL
- **Django**: `filter`·`annotate`·`aggregate`, JSON 필드 키 조회
- **Rails**: `where`·`group`·`limit`, 바인딩한 SQL 조각
- **Spring Boot**: JPQL·Criteria·`@Query(nativeQuery = true)`, `Pageable`
- **스택 무관 (CDN · DB · 인프라)**: Postgres `jsonb_path_query_array`·`jsonb_array_length`, MySQL `JSON_EXTRACT`

### 9. N+1 없애기

- **Next.js · Vercel**: Prisma 관계 `select`/`include`, 또는 `where: { id: { in: ids } }`로 한 번에
- **Node (Express · NestJS)**: 같은 방법 + GraphQL이면 DataLoader
- **Django**: `select_related`, `prefetch_related`
- **Rails**: `includes`/`preload`, `strict_loading`, Bullet gem
- **Spring Boot**: `JOIN FETCH`, `@EntityGraph`, `hibernate.default_batch_fetch_size`
- **스택 무관 (CDN · DB · 인프라)**: 쿼리 로그에 같은 모양의 쿼리가 N번 나오는지

### 10. 쓰기 후 큰 행을 되돌려 받지 않기

- **Next.js · Vercel**: upsert·update에 `select: { 키: true }`
- **Node (Express · NestJS)**: Prisma `select`, Knex `.returning("id")`
- **Django**: `QuerySet.update()`, `save(update_fields=[…])`
- **Rails**: `update_all`, `upsert_all(…, returning: [:id])`
- **Spring Boot**: `@Modifying @Query("update …")`
- **스택 무관 (CDN · DB · 인프라)**: SQL `RETURNING id`(`RETURNING *` 피하기)

### 11. 트랜잭션과 유일 제약

- **Next.js · Vercel**: `prisma.$transaction`, 스키마 `@@unique`
- **Node (Express · NestJS)**: Prisma `$transaction`, TypeORM `dataSource.transaction`, Knex `transaction`
- **Django**: `transaction.atomic`, `UniqueConstraint`
- **Rails**: `transaction do … end`, 유일성 검증 + DB 유일 인덱스
- **Spring Boot**: `@Transactional`, 유일 인덱스·`@Column(unique = true)`
- **스택 무관 (CDN · DB · 인프라)**: 유일성은 DB 제약이 최종 방어선

### 12. 파라미터 바인딩

- **Next.js · Vercel**: Prisma 쿼리 빌더, `$queryRaw` 템플릿(`$queryRawUnsafe`에 입력값 금지)
- **Node (Express · NestJS)**: ORM, `pg` 자리표시자 `$1`
- **Django**: ORM, `cursor.execute(sql, params)`
- **Rails**: `where("title = ?", t)`, `sanitize_sql`
- **Spring Boot**: JPQL `:name` 파라미터, `JdbcTemplate`의 `?`
- **스택 무관 (CDN · DB · 인프라)**: SQL 문자열 이어 붙이기 금지

### 13. 스키마 변경(마이그레이션)

- **Next.js · Vercel**: Prisma Migrate(로컬 `migrate dev`, 운영 `migrate deploy`)
- **Node (Express · NestJS)**: Prisma·Knex·TypeORM 마이그레이션
- **Django**: `makemigrations` / `migrate`
- **Rails**: `db:migrate`, strong_migrations gem
- **Spring Boot**: Flyway · Liquibase
- **스택 무관 (CDN · DB · 인프라)**: 추가 → 코드 전환 → 정리(expand–contract)

### 14. 로컬 DB, 운영 DB 접속 차단

- **Next.js · Vercel**: `.env.local`, 개발 서버 시작 시 `DATABASE_URL` 호스트 검사, 호스팅의 운영 DB 변수는 운영 환경에만
- **Node (Express · NestJS)**: 개발 모드에서 DB 호스트 검사, Testcontainers
- **Django**: 환경별 `DATABASES`, `DEBUG`일 때 원격 호스트 거부
- **Rails**: `config/database.yml`의 development·test는 localhost
- **Spring Boot**: `application-local.yml` 프로필, Testcontainers
- **스택 무관 (CDN · DB · 인프라)**: `docker compose`로 Postgres·MySQL, 시드 데이터

### 15. 쿼리 측정

- **Next.js · Vercel**: Prisma 쿼리 로그(`log: ["query"]`), DB 앞 중계기로 바이트 세기
- **Node (Express · NestJS)**: ORM 쿼리 로그, OpenTelemetry
- **Django**: Django Debug Toolbar, `connection.queries`, django-silk
- **Rails**: SQL 로그, rack-mini-profiler, Bullet
- **Spring Boot**: `hibernate.generate_statistics`, Actuator·Micrometer
- **스택 무관 (CDN · DB · 인프라)**: Postgres `pg_stat_statements`(반환 행 순), MySQL `performance_schema`

## 보안

### 16. 서버에서 로그인·권한 확인, CSRF

- **Next.js · Vercel**: Auth.js 등 + 서버 액션·라우트 핸들러 첫 줄에서 세션·역할 확인
- **Node (Express · NestJS)**: Passport·세션 미들웨어, Nest Guard(`@UseGuards`)
- **Django**: `login_required`, `PermissionRequiredMixin`, CSRF 미들웨어(기본 켜짐)
- **Rails**: Devise 등, Pundit·CanCanCan, `protect_from_forgery`(기본 켜짐)
- **Spring Boot**: Spring Security `SecurityFilterChain`, `@PreAuthorize`, CSRF(기본 켜짐)
- **스택 무관 (CDN · DB · 인프라)**: SameSite 쿠키, 소유자 조건을 쿼리에 포함

### 17. 입력값 검증

- **Next.js · Vercel**: zod 등으로 서버에서 검증
- **Node (Express · NestJS)**: zod·joi, Nest `ValidationPipe` + class-validator
- **Django**: Form · DRF Serializer
- **Rails**: strong parameters + 모델 validations
- **Spring Boot**: Bean Validation(`@Valid`, `@NotBlank`)
- **스택 무관 (CDN · DB · 인프라)**: 브라우저 검증은 편의일 뿐, 서버 검증이 진짜

### 18. 비밀 값 관리

- **Next.js · Vercel**: `NEXT_PUBLIC_` 접두사는 브라우저로 간다 — 비밀에 쓰지 않기, `server-only` 패키지
- **Node (Express · NestJS)**: dotenv·비밀 저장소, 프런트 번들러의 공개 접두사(`VITE_` 등) 주의
- **Django**: 환경 변수(`SECRET_KEY` 등), django-environ
- **Rails**: `credentials.yml.enc` + `RAILS_MASTER_KEY`
- **Spring Boot**: 환경 변수·`${…}` 자리표시자, Vault·Secrets Manager
- **스택 무관 (CDN · DB · 인프라)**: 저장소 비밀 검사(secret scanning)

### 19. 비밀번호 저장

- **Next.js · Vercel**: bcrypt·argon2 라이브러리
- **Node (Express · NestJS)**: bcrypt·argon2
- **Django**: 기본 PBKDF2, `Argon2PasswordHasher` 권장
- **Rails**: `has_secure_password`(bcrypt)
- **Spring Boot**: `BCryptPasswordEncoder`, `DelegatingPasswordEncoder`
- **스택 무관 (CDN · DB · 인프라)**: 평문·빠른 해시(MD5·SHA-1) 금지

## 외부 API

### 20. 클라이언트 모듈 하나(타임아웃·재시도·성공 판정·쿨다운)

- **Next.js · Vercel**: `fetch` + `AbortSignal.timeout(ms)`, 성공만 `unstable_cache`
- **Node (Express · NestJS)**: `fetch`·axios(`timeout`), Nest `HttpModule`
- **Django**: `requests`·`httpx`(`timeout=` 필수), tenacity로 재시도
- **Rails**: Faraday(+ faraday-retry), `Net::HTTP`의 `open_timeout`·`read_timeout`
- **Spring Boot**: `RestClient`·`WebClient` 타임아웃, Resilience4j(Retry·CircuitBreaker)
- **스택 무관 (CDN · DB · 인프라)**: 회로 차단기(circuit breaker)가 "실패 직후 쿨다운"의 일반형

### 21. 같은 요청 동시 호출 묶기(single-flight)

- **Next.js · Vercel**: `Map<키, Promise>`
- **Node (Express · NestJS)**: `Map<키, Promise>`
- **Django**: 캐시 잠금(`cache.add`) 또는 asyncio Task 공유
- **Rails**: `Rails.cache.fetch(…, race_condition_ttl:)`, 잠금
- **Spring Boot**: `@Cacheable(sync = true)`
- **스택 무관 (CDN · DB · 인프라)**: Go `singleflight`와 같은 패턴

## 트래픽·운영

### 22. 속도 제한·봇 차단

- **Next.js · Vercel**: `proxy.ts`(16부터 middleware 이름 변경)에서 User Agent 403, Vercel Firewall 규칙
- **Node (Express · NestJS)**: express-rate-limit, Nest `@nestjs/throttler`
- **Django**: django-ratelimit, DRF throttling
- **Rails**: rack-attack
- **Spring Boot**: Bucket4j, Resilience4j RateLimiter
- **스택 무관 (CDN · DB · 인프라)**: Cloudflare WAF · AWS WAF(배포 없이 적용)

### 23. 모든 요청 앞 코드의 범위 좁히기

- **Next.js · Vercel**: `proxy.ts`의 `config.matcher`(경로·쿠키 조건)
- **Node (Express · NestJS)**: `app.use("/경로", mw)`, Nest `forRoutes`·`exclude`
- **Django**: 전역 미들웨어 대신 뷰 데코레이터, 미들웨어 첫 줄에서 경로 검사
- **Rails**: `before_action … only:`/`except:`
- **Spring Boot**: `OncePerRequestFilter#shouldNotFilter`, `FilterRegistrationBean#addUrlPatterns`
- **스택 무관 (CDN · DB · 인프라)**: 정적 파일·이미지는 앱 서버 앞(CDN)에서 처리

### 24. 백그라운드·예약 작업

- **Next.js · Vercel**: Vercel Cron, `after()`, 큐 서비스
- **Node (Express · NestJS)**: BullMQ, node-cron, Nest `@nestjs/schedule`
- **Django**: Celery, RQ
- **Rails**: Active Job + Solid Queue · Sidekiq
- **Spring Boot**: `@Scheduled`, `@Async`, Spring Batch
- **스택 무관 (CDN · DB · 인프라)**: 무거운 재계산은 요청 밖에서, 중복 실행 방지

### 25. SEO(메타·canonical·robots·사이트맵)

- **Next.js · Vercel**: `generateMetadata`(`alternates.canonical`, `robots`), `app/robots.ts`, `app/sitemap.ts`
- **Node (Express · NestJS)**: 템플릿 `<head>`, `sitemap` 패키지
- **Django**: 템플릿 블록, `django.contrib.sitemaps`
- **Rails**: 레이아웃 `content_for :head`, sitemap_generator gem
- **Spring Boot**: Thymeleaf `<head>`, 사이트맵 컨트롤러
- **스택 무관 (CDN · DB · 인프라)**: 영구 이동 301/308, 변형 페이지 `noindex, follow`

### 26. 필요할 때만 배포

- **Next.js · Vercel**: `vercel.json`의 `ignoreCommand`
- **Node (Express · NestJS)**: CI 경로 필터(GitHub Actions `paths-ignore` 등)
- **Django**: CI 경로 필터
- **Rails**: CI 경로 필터
- **Spring Boot**: CI 경로 필터
- **스택 무관 (CDN · DB · 인프라)**: 미리보기 배포는 끄거나 별도 DB

## 작은 사이트 · 소재 (v3 — 모두 미검증, 공식 문서로 확인)

### 27. 전부 정적으로 만들기

- **Next.js · Vercel**: 정적 렌더링되는 라우트만 두기(빌드 결과의 라우트 표시로 확인), 완전 정적이면 `next.config`의 `output: 'export'`
- **Node (Express · NestJS)**: 정적 사이트 생성기(Astro·Eleventy 등)로 따로 만들거나 빌드 때 HTML 저장
- **Django**: 빌드 때 HTML로 내보내는 도구, 또는 정적 사이트 생성기 분리
- **Rails**: 정적 사이트 생성기 분리
- **Spring Boot**: 정적 사이트 생성기 분리
- **스택 무관 (CDN · DB · 인프라)**: CDN 정적 호스팅, 캐시 수명 길게 + 파일 이름에 해시

### 28. 이미지를 빌드 때 미리 만들기 (종량제 변환 끄기)

- **Next.js · Vercel**: `next/image`는 기본적으로 이미지 최적화를 쓴다(Vercel에서는 종량제 이미지 변환으로 센다) → 작은 사이트는 `images.unoptimized` + 빌드 스크립트(sharp 등)로 크기별 파일 생성. 정적 내보내기(`output: 'export'`)에서는 기본 변환을 쓸 수 없다
- **Node (Express · NestJS)**: sharp로 빌드 때 생성
- **Django**: 빌드 스크립트(Pillow) 또는 정적 사이트 생성기의 이미지 기능
- **Rails**: 빌드 스크립트(image_processing / libvips)
- **Spring Boot**: 빌드 스크립트
- **스택 무관 (CDN · DB · 인프라)**: `<img srcset sizes>` + `width`·`height`(레이아웃 흔들림 방지), WebP·AVIF

### 29. 가게 정보 구조화 데이터

- **Next.js · Vercel**: 페이지에 `<script type="application/ld+json">`(내용은 `content/`에서 만든다)
- **Node (Express · NestJS)**: 템플릿 `<head>`에 JSON-LD
- **Django**: 템플릿 블록에 JSON-LD
- **Rails**: 레이아웃 `content_for :head`에 JSON-LD
- **Spring Boot**: Thymeleaf `<head>`에 JSON-LD
- **스택 무관 (CDN · DB · 인프라)**: schema.org `Restaurant`·`LocalBusiness`(`address`·`telephone`·`openingHoursSpecification`), 검색 엔진의 구조화 데이터 검사 도구로 확인

### 30. 글꼴 불러오기와 라이선스

- **Next.js · Vercel**: `next/font`(빌드 때 내려받아 자체 호스팅, 부분 집합 지정) — 라이선스 확인은 따로 한다
- **Node (Express · NestJS)**: `@fontsource/*` 패키지(라이선스가 package.json에 적혀 있다) + `font-display: swap`
- **Django**: 정적 파일로 woff2 + 라이선스 파일 함께
- **Rails**: 자산 파이프라인으로 woff2 + 라이선스 파일 함께
- **Spring Boot**: 정적 자원으로 woff2 + 라이선스 파일 함께
- **스택 무관 (CDN · DB · 인프라)**: SIL OFL 1.1 글꼴은 파일을 배포할 때 라이선스 전문을 함께 둔다. 한글 글꼴은 부분 집합·동적 분할 파일로

---

## FastAPI 메모 (도면3D에서 쓴 것 — 표에 열로 올리기 전 단계)

- 업로드 크기 제한: 요청 본문을 조각으로 읽으며 합계가 한도를 넘으면 413 (전부 메모리에 올리지 않기)
- 형식 검사: 확장자 대신 파일 앞부분으로 판단, 이미지는 Pillow로 픽셀만 다시 저장(EXIF 제거) → 15장
- CORS: `CORSMiddleware`의 `allow_origins`를 환경 변수 목록으로(와일드카드 금지)
- 보안 헤더: 미들웨어 하나에서 `nosniff`·`Referrer-Policy`·API용 `CSP default-src 'none'`·`/api`에 `Cache-Control: private, no-store`
- 입력 검증: pydantic 모델(정규식·범위)로 첫 단계에서 거절, 저장소 ID는 정해진 모양(예: 32자리 16진수)만 허용 → 경로 탈출 방지
- 오래 걸리는 작업: RQ + Redis(`Queue.enqueue(..., job_timeout=)`), 개발 중엔 Redis 없이 스레드로 대신 → 6장
- 속도 제한: 작은 서비스는 메모리 안의 IP별 카운터로 시작, 서버가 여러 대가 되면 Redis로
