// 도면3D — 한 화면 안에서 4단계: 올리기 → 벽 고르기 → 만들기 → 확인·받기
// 결정: preset=calm · mode=light · accent=먹빛 남색(지금 고른 것) — SITE_REQUEST.md
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge, Button, Checkbox, Dropzone, EmptyState, ProgressBar, Select, SiteHeader, SpecList, Stepper, TextField, cx,
} from "@design";
import { ApiError, fileUrl, getJob, kb, sampleFile, startJob, upload, type Analysis, type Job, type JobOptions, type UploadRes } from "./api";
import { Plan2D } from "./Plan2D";
// three.js(약 600KB)는 결과 화면에서만 불러온다 — 첫 화면을 가볍게 (풀스택 19장)
const Viewer3D = lazy(() => import("./Viewer3D").then((m) => ({ default: m.Viewer3D })));

type Stage = "upload" | "review" | "running" | "result" | "failed";
const STEPS = ["도면 올리기", "벽 고르기", "3D 만들기", "확인·받기"];
const stepIndex: Record<Stage, number> = { upload: 0, review: 1, running: 2, result: 3, failed: 2 };

const PlanIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M6 6h28v28H6z" />
    <path d="M6 20h12M18 6v9M18 24v10M26 20h8" />
    <path d="M18 15a5 5 0 0 1 5 5" strokeDasharray="2 2" />
  </svg>
);

const jobFromHash = () => (location.hash.match(/^#job-([0-9a-f]{32})$/) ?? [])[1] ?? null;

export default function App() {
  const [stage, setStage] = useState<Stage>("upload");
  const [busy, setBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string>();
  const [up, setUp] = useState<UploadRes | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opt, setOpt] = useState<Omit<JobOptions, "wallLayers">>({ heightM: 2.4, thicknessM: 0.2, mode: "auto" });
  const [job, setJob] = useState<Job | null>(null);
  const [jobId, setJobId] = useState<string | null>(jobFromHash);
  const [viewerErr, setViewerErr] = useState<string>();

  const analysis = up?.analysis ?? null;

  // 단계가 바뀌면 맨 위로 (단계 표시가 머리 메뉴에 가려지지 않게)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage]);

  // 주소가 바뀌면(다른 결과 링크를 붙여 넣는 등) 그 작업을 연다
  useEffect(() => {
    const onHash = () => {
      const id = jobFromHash();
      if (id) setJobId(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // 주소의 #job-… 로 결과를 다시 연다 (7일 보관)
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const poll = async () => {
      try {
        const j = await getJob(jobId);
        if (stop) return;
        setJob(j);
        if (j.status === "done") setStage("result");
        else if (j.status === "failed") setStage("failed");
        else {
          setStage("running");
          setTimeout(poll, 700);
        }
      } catch (e) {
        if (stop) return;
        setJob({ id: jobId, status: "failed", step: "", progress: 0, error: { code: "x", message: (e as Error).message } });
        setStage("failed");
      }
    };
    poll();
    return () => {
      stop = true;
    };
  }, [jobId]);

  const onFile = useCallback(async (file: File) => {
    setUploadErr(undefined);
    setBusy(true);
    try {
      const res = await upload(file);
      if (res.kind === "image") {
        setUploadErr(res.notice);
        return;
      }
      setUp(res);
      setSelected(new Set(res.analysis!.layers.filter((l) => l.suggestedWall).map((l) => l.name)));
      setStage("review");
      history.replaceState(null, "", location.pathname);
    } catch (e) {
      setUploadErr(e instanceof ApiError ? e.message : "올리지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, []);

  const trySample = useCallback(async () => {
    try {
      onFile(await sampleFile());
    } catch (e) {
      setUploadErr((e as Error).message);
    }
  }, [onFile]);

  const run = async () => {
    if (!up) return;
    setBusy(true);
    try {
      const { jobId: id } = await startJob(up.uploadId, { ...opt, wallLayers: [...selected] });
      setJob(null);
      setViewerErr(undefined);
      setStage("running");
      history.replaceState(null, "", `#job-${id}`);
      setJobId(id);
    } catch (e) {
      setUploadErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStage("upload");
    setUp(null);
    setJob(null);
    setJobId(null);
    history.replaceState(null, "", location.pathname);
  };
  const onViewerError = useCallback((m: string) => setViewerErr(m), []);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        brand={<span className="tracking-title">도면3D</span>}
        items={[
          { label: "변환하기", href: "#", current: true },
          { label: "사용법", href: "#how" },
        ]}
        menuLabel="메뉴"
      />

      <main className="container-page flex-1 pb-24">
        {stage === "upload" ? (
          <UploadStage busy={busy} error={uploadErr} onFile={onFile} onSample={trySample} />
        ) : (
          <div className="pt-8">
            <Stepper steps={STEPS} current={stepIndex[stage]} className="mb-8" />
            {stage === "review" || stage === "running" ? (
              analysis && up ? (
                <ReviewStage
                  fileName={up.fileName ?? "도면"}
                  analysis={analysis}
                  selected={selected}
                  setSelected={setSelected}
                  opt={opt}
                  setOpt={setOpt}
                  running={stage === "running"}
                  job={job}
                  busy={busy}
                  error={uploadErr}
                  onRun={run}
                  onRestart={restart}
                />
              ) : (
                <ProgressBar value={job?.progress ?? 5} label={job?.step || "접수"} className="max-w-md" />
              )
            ) : null}
            {stage === "result" && job?.metrics && job.files ? (
              <ResultStage job={job} viewerErr={viewerErr} onViewerError={onViewerError} onRestart={restart} onBack={analysis ? () => setStage("review") : undefined} />
            ) : null}
            {stage === "failed" ? (
              <EmptyState
                kind="error"
                title="3D로 바꾸지 못했어요"
                description={job?.error?.message ?? "알 수 없는 문제가 생겼어요."}
                action={
                  <div className="flex gap-2">
                    {analysis ? <Button onClick={() => setStage("review")}>설정 바꿔 다시 하기</Button> : null}
                    <Button variant="secondary" onClick={restart}>다른 도면 올리기</Button>
                  </div>
                }
              />
            ) : null}
          </div>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="container-page flex flex-wrap justify-between gap-2 py-6 text-label text-ink-3">
          <span>올린 도면과 결과는 7일 뒤 자동으로 지워져요. 로그인은 필요 없어요.</span>
          <span>도면3D · 졸업작품</span>
        </div>
      </footer>
    </div>
  );
}

function UploadStage({ busy, error, onFile, onSample }: { busy: boolean; error?: string; onFile: (f: File) => void; onSample: () => void }) {
  return (
    <>
      <section className="grid items-center gap-10 pt-16 pb-20 lg:grid-cols-12 lg:pt-24">
        <div className="lg:col-span-5">
          <p className="eyebrow mb-4">건축 평면도 → 3D 모델</p>
          <h1 className="text-display font-semibold tracking-display font-display">
            평면도를 올리면
            <br />
            <span className="text-ink-3">3D 모델로 세워요</span>
          </h1>
          <p className="mt-6 max-w-md text-body text-ink-2">
            DXF 도면에서 벽 레이어를 골라 원하는 높이로 세워요. 웹에서 바로 돌려 보고 GLB·OBJ·STL 파일로 받을 수 있어요.
          </p>
        </div>
        <div className="lg:col-span-7">
          <Dropzone
            onFile={onFile}
            accept=".dxf,.png,.jpg,.jpeg"
            icon={<PlanIcon />}
            title="도면 파일을 끌어다 놓으세요"
            hint="DXF · PNG · JPG, 20MB까지 — 이미지 변환은 준비 중"
            busy={busy}
            busyText="도면을 읽는 중…"
            error={error}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-4">
            <Button variant="text" onClick={onSample}>샘플 도면으로 해 보기</Button>
            <a href={fileUrl("/api/sample.dxf")} className="text-body-sm text-ink-3 underline-offset-4 hover:text-ink hover:underline">샘플 DXF 받기</a>
          </div>
        </div>
      </section>

      <section id="how" className="grid gap-10 border-t border-line pt-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="text-title font-semibold font-display">어떻게 바뀌나요</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              ["도면 올리기", "DXF를 올리면 레이어와 단위를 읽어요."],
              ["벽 고르기", "벽이 그려진 레이어를 고르고 높이를 정해요."],
              ["3D 확인·받기", "돌려 보고 단면을 확인한 뒤 파일로 받아요."],
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
              { label: "입력", value: "DXF (R12 이상)", note: "DWG는 DXF로 저장해 올려 주세요" },
              { label: "단위", value: "mm · cm · m 자동 인식" },
              { label: "벽 그리는 방식", value: "두 줄 · 중심선 자동 판별" },
              { label: "결과", value: "GLB · OBJ · STL" },
              { label: "보관", value: "7일 뒤 삭제" },
            ]}
          />
        </div>
      </section>
    </>
  );
}

function ReviewStage(p: {
  fileName: string;
  analysis: Analysis;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  opt: Omit<JobOptions, "wallLayers">;
  setOpt: (o: Omit<JobOptions, "wallLayers">) => void;
  running: boolean;
  job: Job | null;
  busy: boolean;
  error?: string;
  onRun: () => void;
  onRestart: () => void;
}) {
  const { analysis: a, selected } = p;
  const lineCount = useMemo(() => a.layers.reduce((n, l) => n + l.count, 0), [a]);
  const toggle = (name: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(name);
    else next.delete(name);
    p.setSelected(next);
  };
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Plan2D analysis={a} selected={selected} />
      <aside className="min-w-0">
        <p className="eyebrow">올린 도면</p>
        <h2 className="mt-1 truncate text-title-sm font-semibold" title={p.fileName}>{p.fileName}</h2>
        <SpecList
          className="mt-4"
          dense
          items={[
            { label: "크기", value: `${a.sizeM[0]} × ${a.sizeM[1]}`, unit: "m" },
            { label: "단위", value: a.unit, note: a.unitGuessed ? "도면에 단위가 없어 크기로 짐작했어요" : undefined },
            { label: "선", value: lineCount.toLocaleString("ko-KR"), unit: "개" },
          ]}
        />

        <fieldset className="mt-8" disabled={p.running}>
          <legend className="text-body-sm font-medium text-ink calm:text-label calm:text-ink-2">벽이 그려진 레이어</legend>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {a.layers.map((l) => (
              <li key={l.name} className="flex items-center gap-3 py-2.5">
                <Checkbox
                  className="min-w-0 flex-1"
                  checked={selected.has(l.name)}
                  onChange={(e) => toggle(l.name, e.target.checked)}
                  label={<span className={cx("font-mono text-body-sm", selected.has(l.name) && "text-accent font-semibold")}>{l.name}</span>}
                  description={`선 ${l.count.toLocaleString("ko-KR")}개 · ${l.lengthM.toLocaleString("ko-KR")} m`}
                />
                {l.suggestedWall ? <Badge>추천</Badge> : null}
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6">
          <Select
            className="col-span-2"
            label="벽 그리는 방식"
            value={p.opt.mode}
            disabled={p.running}
            onChange={(e) => p.setOpt({ ...p.opt, mode: e.target.value as JobOptions["mode"] })}
            options={[
              { value: "auto", label: "자동으로 판별" },
              { value: "outline", label: "두 줄 (벽 양쪽 면)" },
              { value: "centerline", label: "한 줄 (벽 중심선)" },
            ]}
          />
          <TextField
            label="벽 높이"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={1}
            max={20}
            value={p.opt.heightM}
            disabled={p.running}
            onChange={(e) => p.setOpt({ ...p.opt, heightM: Number(e.target.value) })}
            trailing={<span className="text-body-sm text-ink-3">m</span>}
          />
          <TextField
            label="벽 두께"
            type="number"
            inputMode="decimal"
            step={0.01}
            min={0.02}
            max={1}
            value={p.opt.thicknessM}
            disabled={p.running || p.opt.mode === "outline"}
            hint="한 줄 도면일 때만 써요"
            onChange={(e) => p.setOpt({ ...p.opt, thicknessM: Number(e.target.value) })}
            trailing={<span className="text-body-sm text-ink-3">m</span>}
          />
        </div>

        <div className="mt-8">
          {p.running ? (
            <ProgressBar value={p.job?.progress ?? 5} label={p.job?.step || "접수"} />
          ) : (
            <Button
              block
              size="lg"
              loading={p.busy}
              disabledReason={selected.size === 0 ? "벽이 그려진 레이어를 하나 이상 골라 주세요" : undefined}
              onClick={p.onRun}
            >
              3D로 만들기
            </Button>
          )}
          {p.error ? <p className="mt-3 text-label text-danger">{p.error}</p> : null}
          <Button variant="text" className="mt-3" onClick={p.onRestart}>다른 도면 올리기</Button>
        </div>
      </aside>
    </div>
  );
}

function ResultStage({ job, viewerErr, onViewerError, onRestart, onBack }: {
  job: Job; viewerErr?: string; onViewerError: (m: string) => void; onRestart: () => void; onBack?: () => void;
}) {
  const m = job.metrics!;
  const f = job.files!;
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <Suspense fallback={<div className="aspect-4/3 w-full border border-line bg-surface-2" />}>
          <Viewer3D url={fileUrl(f.glb.url)} heightM={m.heightM} onError={onViewerError} />
        </Suspense>
        {viewerErr ? <p className="mt-3 text-label text-danger">{viewerErr}</p> : null}
      </div>
      <aside className="min-w-0">
        <p className="eyebrow">결과</p>
        <h2 className="mt-1 text-title font-semibold font-display">3D 모델</h2>
        <SpecList
          className="mt-4"
          items={[
            { label: "가로 × 세로", value: `${m.widthM} × ${m.depthM}`, unit: "m" },
            { label: "벽 높이", value: m.heightM, unit: "m" },
            { label: "바닥 면적", value: m.floorAreaM2.toLocaleString("ko-KR"), unit: "m²" },
            { label: "벽 방식", value: m.mode === "outline" ? "두 줄 (양쪽 면)" : "한 줄 (중심선)" },
            { label: "삼각형", value: m.triangles.toLocaleString("ko-KR"), unit: "개" },
            { label: "처리 시간", value: m.seconds, unit: "초" },
          ]}
        />
        <div className="mt-8 grid gap-2">
          <Button href={fileUrl(f.glb.url, true)} block size="lg">GLB 받기 · {kb(f.glb.bytes)}</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button href={fileUrl(f.obj.url, true)} variant="secondary">OBJ · {kb(f.obj.bytes)}</Button>
            <Button href={fileUrl(f.stl.url, true)} variant="secondary">STL · {kb(f.stl.bytes)}</Button>
          </div>
          <p className="mt-1 text-label text-ink-3">GLB·OBJ는 Y축이 위, STL은 Z축이 위(3D 프린팅용)예요. 이 주소로 7일 동안 다시 볼 수 있어요.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-2">
          {onBack ? <Button variant="text" onClick={onBack}>설정 바꿔 다시 만들기</Button> : null}
          <Button variant="text" onClick={onRestart}>다른 도면 올리기</Button>
        </div>
      </aside>
    </div>
  );
}
