// Auto-BIM 프론트 — 화면은 세 가지: 올리기 → 인식 중 → 작업(확인·고치기·받기)
// 결정: preset=calm · mode=light · accent=먹빛 남색(한 가지 의미: 지금 고른 것) — SITE_REQUEST.md
//
// 어느 화면을 보여줄지는 "작업(job)의 상태"로만 정한다. 화면 상태를 따로 들고 있지 않으면
// 새로 고침하거나 주소(#job-…)를 공유해도 같은 화면이 나온다.
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Button, Dropzone, EmptyState, ProgressBar, SiteHeader, SpecList, Stepper, ToastProvider } from "@design";
import { ACCEPT, ApiError, MAX_UPLOAD_MB, createJob, errorText } from "./api";
import { useJob } from "./useJob";
import { Workspace } from "./Workspace";

// 첫 화면의 3D 모형도 three.js를 쓰므로 나중에 불러온다
const HeroModel = lazy(() => import("./HeroModel").then((m) => ({ default: m.HeroModel })));

const STEPS = ["도면 올리기", "벽·문·창 인식", "확인·고치기·받기"];

const PlanIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M6 6h28v28H6z" />
    <path d="M6 20h12M18 6v9M18 24v10M26 20h8" />
    <path d="M18 15a5 5 0 0 1 5 5" strokeDasharray="2 2" />
  </svg>
);

// 주소 #job-<작업 ID> — 결과를 다시 열거나 팀원에게 보낼 수 있게
const jobFromHash = () => (location.hash.match(/^#job-([0-9a-f]{32})$/) ?? [])[1] ?? null;

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const [jobId, setJobId] = useState<string | null>(jobFromHash);
  const { job, error, busy, track } = useJob(jobId);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string>();

  useEffect(() => {
    const onHash = () => setJobId(jobFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const onFile = useCallback(
    async (file: File) => {
      setUploadErr(undefined);
      // 브라우저에서 먼저 거른다 — 최종 판단은 서버(415)
      const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
      if (!ACCEPT.split(",").includes(ext)) return setUploadErr(errorText("unsupported_media_type"));
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return setUploadErr(`파일이 너무 커요. ${MAX_UPLOAD_MB}MB 이하로 올려 주세요.`);
      setUploading(true);
      try {
        const j = await createJob(file);
        history.pushState(null, "", `#job-${j.id}`);
        setJobId(j.id);
        track(j);
        window.scrollTo({ top: 0 });
      } catch (e) {
        setUploadErr(e instanceof ApiError ? e.message : "올리지 못했어요. 다시 시도해 주세요.");
      } finally {
        setUploading(false);
      }
    },
    [track],
  );

  const trySample = useCallback(async () => {
    const res = await fetch("/sample/plan.png").catch(() => null);
    if (!res?.ok) return setUploadErr("샘플 평면도를 불러오지 못했어요.");
    onFile(new File([await res.blob()], "sample-plan.png", { type: "image/png" }));
  }, [onFile]);

  const restart = () => {
    history.pushState(null, "", location.pathname);
    setJobId(null);
    setUploadErr(undefined);
  };

  // ─── 지금 보여줄 화면 ───
  let content;
  if (!jobId) {
    content = <UploadStage busy={uploading} error={uploadErr} onFile={onFile} onSample={trySample} />;
  } else if (error && !job) {
    content = (
      <EmptyState kind="error" className="pt-16" title="결과를 열 수 없어요" description={error.message}
        action={<Button onClick={restart}>도면 올리기</Button>} />
    );
  } else if (job && job.result_revision !== null) {
    content = <Workspace key={job.id} job={job} busy={busy} track={track} onRestart={restart} />;
  } else if (job?.status === "failed") {
    content = (
      <div className="pt-8">
        <Stepper steps={STEPS} current={1} className="mb-8" />
        <EmptyState kind="error" title="인식하지 못했어요" description={errorText(job.error?.code ?? "", job.error?.message)}
          action={<Button onClick={restart}>다른 도면 올리기</Button>} />
      </div>
    );
  } else {
    content = (
      <div className="pt-8">
        <Stepper steps={STEPS} current={1} className="mb-10" />
        <div className="max-w-lg">
          <h1 className="text-title-lg font-display tracking-display">{job?.input.filename ?? "도면"}을 읽고 있어요</h1>
          <p className="mt-2 text-body-sm text-ink-2">벽·문·창을 찾아 3D와 .dxf를 만들어요. 이 주소를 저장해 두면 나중에 다시 열 수 있어요.</p>
          <ProgressBar
            className="mt-8"
            value={job?.status === "running" ? 60 : 15}
            label={job?.status === "running" ? "인식하고 3D를 만드는 중" : "차례를 기다리는 중"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        brand={<a href="#" onClick={(e) => { e.preventDefault(); restart(); }} className="tracking-title">Auto-BIM</a>}
        items={[
          { label: "변환하기", href: "#", current: !jobId },
          { label: "사용법", href: "#how" },
        ]}
        menuLabel="메뉴"
      />
      <main className="container-page flex-1 pb-24">{content}</main>
      <footer className="border-t border-line">
        <div className="container-page flex flex-wrap justify-between gap-2 py-6 text-label text-ink-3">
          <span>로그인 없이 써요. 결과는 작업 주소를 아는 사람만 열 수 있어요.</span>
          <span>Auto-BIM · 가천대 AI P-실무프로젝트 2분반 3조</span>
        </div>
      </footer>
    </div>
  );
}

function UploadStage({ busy, error, onFile, onSample }: { busy: boolean; error?: string; onFile: (f: File) => void; onSample: () => void }) {
  return (
    <>
      <section aria-label="샘플 모형" className="pt-6 lg:pt-8">
        <Suspense fallback={<div className="aspect-4/3 w-full sm:aspect-16/10 lg:aspect-21/9" />}>
          <HeroModel />
        </Suspense>
      </section>

      <section className="grid items-center gap-10 pt-12 pb-20 lg:grid-cols-12 lg:pt-16">
        <div className="lg:col-span-5">
          <p className="eyebrow mb-4">2D 평면도 → 객체별 3D</p>
          <h1 className="text-display tracking-display font-display">
            평면도를 올리면
            <br />
            <span className="text-ink-3">벽·문·창이 나뉜 3D로</span>
          </h1>
          <p className="mt-6 max-w-md text-body text-ink-2">
            이미지나 DXF 평면도에서 벽·문·창을 따로 인식해 3D로 세워요. 확실하지 않은 곳은 임의로 고치지 않고 물어보고, 스케치업·캐드에서 벽마다 편집할 수 있는 .dxf로 받아요.
          </p>
        </div>
        <div className="lg:col-span-7">
          <Dropzone
            onFile={onFile}
            accept={ACCEPT}
            icon={<PlanIcon />}
            title="평면도를 끌어다 놓으세요"
            hint={`PNG · JPG · BMP · TIFF · WEBP · DXF, ${MAX_UPLOAD_MB}MB까지`}
            busy={busy}
            busyText="올리는 중…"
            error={error}
          />
          <div className="mt-3">
            <Button variant="text" onClick={onSample}>샘플 평면도로 해 보기</Button>
          </div>
        </div>
      </section>

      <section id="how" className="grid gap-10 border-t border-line pt-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="text-title font-display">어떻게 바뀌나요</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              ["올리기", "평면도 이미지나 DXF를 올려요."],
              ["인식", "벽·문·창을 따로 찾아 3D를 만들고, 확실하지 않은 곳을 표시해요."],
              ["확인·받기", "표시된 곳을 확인하거나 고친 뒤, 벽별 블록 .dxf로 받아요."],
            ].map(([t, d], i) => (
              <li key={t} className="border-t border-ink pt-3">
                <span className="text-label tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 text-body font-semibold">{t}</p>
                <p className="mt-1 text-body-sm text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:col-span-5">
          <SpecList
            items={[
              { label: "입력", value: "평면도 이미지 · DXF", note: "DXF 변환은 준비 중" },
              { label: "인식", value: "벽 · 문 · 창 따로" },
              { label: "크기", value: "치수·외벽 두께로 추정", note: "건물 가로 길이를 넣으면 정확해져요" },
              { label: "결과", value: ".dxf (벽별 블록) · .glb · .json" },
              { label: "화면", value: "PC 기준" },
            ]}
          />
        </div>
      </section>
    </>
  );
}
