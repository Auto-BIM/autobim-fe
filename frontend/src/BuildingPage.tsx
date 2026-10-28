// 건물 화면 — 층을 쌓아 3D로 보고, 층을 골라 들여다보고, 계단을 그려 넣고, 용도에 맞춰 위험을 검토한다.
//
// 두 가지로 열린다
//   샘플(#sample): 코드에 들어 있는 3층 샘플. 서버 없이 바로 시연.
//   내 건물(#b=…): 층마다 올린 도면의 작업 ID + 층고·계단·용도. 주소에 다 들어 있어 새로 고쳐도 남는다.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Select, SpecList, Tabs, TextField, cx } from "@design";
import { createJob, getJob, ApiError, errorText, ACCEPT, MAX_UPLOAD_MB, fileUrl, downloadName, type Job } from "./api";
import {
  USE_LABEL, SLAB_MM, buildingHash, effectiveStairs, defaultFloorHeight, nextStairId, stairDims, stairRiseTread,
  type Building, type FloorModel, type FloorRef, type Stair, type UseKey,
} from "./building";
import { LEVEL_LABEL, STAIR_STD, review, type Finding } from "./rules";
import { ALL_LAYERS, LAYER_LABEL, type Layer } from "./BuildingView";
import { PlanView } from "./PlanView";

const BuildingView = lazy(() => import("./BuildingView").then((m) => ({ default: m.BuildingView })));

type Props = { sample?: FloorModel[]; building?: Building; onChange?: (b: Building) => void };

export function BuildingPage({ sample, building, onChange }: Props) {
  // 샘플은 화면 안에서만 고친다(주소에 안 남음)
  const [sampleState, setSampleState] = useState<{ use: UseKey; floors: FloorModel[] } | null>(sample ? { use: "apartment", floors: sample } : null);
  const jobs = useFloorJobs(building?.floors.map((f) => f.jobId) ?? []);

  const use: UseKey = sampleState?.use ?? building?.use ?? "apartment";
  const refs: FloorRef[] = sampleState?.floors ?? building?.floors ?? [];
  const floors: FloorModel[] = useMemo(
    () =>
      (sampleState
        ? sampleState.floors
        : refs.flatMap((f, i) => {
            const j = jobs[f.jobId];
            return j?.plan ? [{ ...f, plan: j.plan, index: i }] : [];
          })
      // 사용자가 그린 계단이 없으면 인식된 계단실에서 만든 후보를 쓴다(확인 필요)
      ).map((f) => ({ ...f, stairs: effectiveStairs(f, STAIR_STD[use].riser) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sampleState, building, jobs, use],
  );
  const ready = floors.length === refs.length && floors.length > 0;

  const update = (next: { use?: UseKey; floors?: FloorRef[] }) => {
    if (sampleState) setSampleState({ use: next.use ?? sampleState.use, floors: (next.floors as FloorModel[]) ?? sampleState.floors });
    else if (building) onChange?.({ use: next.use ?? building.use, floors: next.floors ?? building.floors });
  };
  const setFloor = (i: number, patch: Partial<FloorRef>) => update({ floors: refs.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  const [layers, setLayers] = useState<Record<Layer, boolean>>({ wall: true, door: true, window: true, floor: true, stair: true, space: true });
  const [focus, setFocus] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [scanToken, setScanToken] = useState(0);
  const [drawFloor, setDrawFloor] = useState<number | null>(null);
  const [stairSel, setStairSel] = useState<string | null>(null);

  // 3D가 다시 지어지는 건 층·계단·층고가 바뀔 때만 — 위험 결과는 그때마다 다시 계산
  const shapeKey = JSON.stringify(floors.map((f) => [f.jobId, f.heightMm, f.stairs, f.plan.walls.length]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFloors = useMemo(() => floors, [shapeKey]);
  const findings = useMemo(() => (ready ? review(stableFloors, use) : []), [stableFloors, use, ready]);
  const shownFindings = scanToken ? findings : [];
  const byKey = useMemo(() => new Map(findings.map((f) => [f.key, f])), [findings]);

  const sel = selected ? floors[Number(selected.split(":")[0])] : null;
  const selFindings = selected ? findings.filter((f) => f.key === selected) : [];

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow mb-2">{sampleState ? "샘플 건물" : "내 건물"} · {refs.length}개 층</p>
          <h1 className="text-display-sm font-display tracking-display">{sampleState ? "샘플 주택" : "건물 보기"}</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Select
              label="건물 용도"
              value={use}
              onChange={(e) => update({ use: e.target.value as UseKey })}
              options={(Object.keys(USE_LABEL) as UseKey[]).map((k) => ({ value: k, label: USE_LABEL[k] }))}
            />
          </div>
          <Button onClick={() => setScanToken((n) => n + 1)} disabledReason={!ready ? "층을 불러오는 중이에요" : undefined}>위험 검토</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-8">
          <div className="relative aspect-4/3 overflow-hidden border border-line bg-bg">
            {ready ? (
              <Suspense fallback={null}>
                <BuildingView
                  floors={stableFloors}
                  className="absolute inset-0"
                  layers={layers}
                  findings={shownFindings}
                  scanToken={scanToken}
                  focus={focus}
                  onFocus={(i) => { setFocus(i); setSelected(null); }}
                  selected={selected}
                  onSelect={setSelected}
                />
              </Suspense>
            ) : (
              <p className="grid size-full place-items-center text-body-sm text-ink-3">{refs.length ? "층 도면을 불러오는 중…" : "층을 추가해 주세요"}</p>
            )}
          </div>

          {/* 층 고르기 · 보이기 */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div role="radiogroup" aria-label="층" className="flex">
              {[{ i: null as number | null, t: "전체" }, ...floors.map((f, i) => ({ i, t: f.name }))].map(({ i, t }) => (
                <button key={t} type="button" role="radio" aria-checked={focus === i} onClick={() => { setFocus(i); setSelected(null); }}
                  className="-ml-px h-9 border border-line px-3 text-body-sm text-ink-2 first:ml-0 hover:text-ink aria-checked:z-10 aria-checked:border-ink aria-checked:bg-ink aria-checked:text-bg">
                  {t}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="보이기">
              {ALL_LAYERS.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-1.5 text-body-sm text-ink-2">
                  <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} className="size-4 accent-(--color-ink)" />
                  {LAYER_LABEL[k]}
                </label>
              ))}
            </div>
          </div>
          <p className="mt-2 text-label text-ink-3">층을 누르면 그 층으로 다가가요 · 벽·문·창·바닥·계단에 커서를 올리면 이름과 치수, 위험이면 이유가 나와요 · Esc로 전체</p>

          {/* 고른 요소 */}
          {selected && sel ? (
            <div className="mt-6 border border-line bg-surface px-4 py-3">
              <p className="text-body-sm font-semibold">{selected.split(":")[1] === "floor" ? `${sel.name} 바닥` : `${sel.name} · ${selected.split(":")[1]}`}</p>
              {selFindings.length ? selFindings.map((f, i) => <FindingText key={i} f={f} floors={floors} />) : <p className="mt-1 text-body-sm text-ink-3">이 요소에는 걸린 위험이 없어요.</p>}
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-6 lg:col-span-4">
          {/* 위험 목록 */}
          <section aria-labelledby="risk-title">
            <h2 id="risk-title" className="flex items-baseline justify-between text-body font-semibold">
              위험 요소 {scanToken ? <span className="text-label font-normal text-ink-3">{findings.length}건 · {USE_LABEL[use]} 기준</span> : null}
            </h2>
            {!scanToken ? (
              <p className="mt-2 text-body-sm text-ink-3">건물 용도를 고르고 "위험 검토"를 누르면, 기준에 못 미치는 곳을 빨갛게 표시해요.</p>
            ) : findings.length ? (
              <ul className="mt-2 border-t border-line">
                {findings.map((f, i) => (
                  <li key={i} className="border-b border-line">
                    <button type="button" onClick={() => { setFocus(f.floor); setSelected(f.key); }} aria-pressed={selected === f.key}
                      className="flex w-full items-baseline gap-3 py-2.5 text-left hover:bg-surface-2 aria-pressed:bg-surface-2">
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-(--color-risk)" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body-sm font-medium text-danger">{f.title}</span>
                        <span className="block text-label text-ink-3">{floors[f.floor]?.name} · {f.measured} → {f.standard}</span>
                      </span>
                      <Badge tone={f.level === "law" ? "danger" : "neutral"}>{LEVEL_LABEL[f.level]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-body-sm text-ink-3">기준에 못 미치는 곳을 찾지 못했어요.</p>
            )}
            <p className="mt-3 text-caption text-ink-3">
              참고용 검토예요. 법률 자문이 아니고, 법령은 바뀔 수 있으니 국가법령정보센터 원문으로 확인해 주세요. 계단 기준({USE_LABEL[use]}): 폭 {STAIR_STD[use].width / 10}cm 이상 · 단높이 {STAIR_STD[use].riser / 10}cm 이하 · 단너비 {STAIR_STD[use].tread / 10}cm 이상.
            </p>
          </section>

          {/* 층 목록 */}
          <section aria-labelledby="floors-title" className="border-t border-ink pt-4">
            <h2 id="floors-title" className="text-body font-semibold">층</h2>
            <ul className="mt-2 space-y-3">
              {refs.map((f, i) => (
                <FloorRow key={`${f.jobId}-${i}`} f={f} autoStairs={floors[i]?.stairs.filter((x) => "auto" in x && x.auto).length ?? 0} i={i} n={refs.length} job={sampleState ? null : jobs[f.jobId]} sample={!!sampleState}
                  onPatch={(p) => setFloor(i, p)}
                  onMove={(d) => { const a = [...refs]; [a[i], a[i + d]] = [a[i + d], a[i]]; update({ floors: a.map((x, k) => ({ ...x, name: `${k + 1}F` })) }); }}
                  onRemove={() => update({ floors: refs.filter((_, k) => k !== i).map((x, k) => ({ ...x, name: `${k + 1}F` })) })}
                  onDrawStair={() => { setDrawFloor(i); setStairSel(null); }} />
              ))}
            </ul>
            {!sampleState ? <AddFloor onAdded={(job) => update({ floors: [...refs, { jobId: job.id, name: `${refs.length + 1}F`, heightMm: 2900, stairs: [] }] })} /> : null}
          </section>
        </aside>
      </div>

      {/* 계단 그리기 */}
      {drawFloor !== null && floors[drawFloor] ? (
        <StairEditor
          floor={floors[drawFloor]}
          risky={new Set(findings.filter((x) => x.floor === drawFloor).map((x) => x.elementId))}
          selected={stairSel}
          setSelected={setStairSel}
          onChange={(stairs) => setFloor(drawFloor, { stairs: stairs.map(({ auto: _auto, ...st }: Stair & { auto?: boolean }) => st) })}
          onClose={() => setDrawFloor(null)}
          use={use}
          byKey={byKey}
        />
      ) : null}
    </div>
  );
}

function FindingText({ f }: { f: Finding; floors: FloorModel[] }) {
  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="text-body-sm font-semibold text-danger">{f.title} <span className="font-normal text-ink-3">· {LEVEL_LABEL[f.level]}</span></p>
      <p className="text-body-sm">{f.measured} → 기준 {f.standard}</p>
      <p className="mt-1 text-body-sm text-ink-2">{f.why}</p>
      <p className="mt-1 text-label text-ink-3">근거: {f.basis}</p>
    </div>
  );
}

function FloorRow({ f, autoStairs, i, n, job, sample, onPatch, onMove, onRemove, onDrawStair }: {
  f: FloorRef; autoStairs: number; i: number; n: number; job: Job | null | undefined; sample: boolean;
  onPatch: (p: Partial<FloorRef>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void; onDrawStair: () => void;
}) {
  const [h, setH] = useState(String(f.heightMm / 1000));
  useEffect(() => setH(String(f.heightMm / 1000)), [f.heightMm]);
  const status = sample ? null : !job ? "불러오는 중" : job.status === "failed" && job.result_revision === null ? errorText(job.error?.code ?? "", job.error?.message) : job.result_revision === null ? "인식 중" : null;
  const dxf = job ? fileUrl(job, "dxf") : null;
  return (
    <li className="border border-line bg-surface px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-body font-semibold">{f.name} {f.note ? <span className="text-label font-normal text-ink-3">{f.note}</span> : null}</p>
        <div className="flex gap-1">
          {!sample ? (
            <>
              <button type="button" disabled={i === 0} onClick={() => onMove(-1)} aria-label={`${f.name} 한 층 아래로`} className="size-8 text-ink-2 hover:text-ink disabled:opacity-30">↓</button>
              <button type="button" disabled={i === n - 1} onClick={() => onMove(1)} aria-label={`${f.name} 한 층 위로`} className="size-8 text-ink-2 hover:text-ink disabled:opacity-30">↑</button>
            </>
          ) : null}
        </div>
      </div>
      {status ? <p className="mt-1 text-label text-ink-3">{status}</p> : null}
      {autoStairs && !f.stairs.length ? (
        <p className="mt-1 flex items-baseline gap-1.5 text-label text-ink-2"><span aria-hidden className="size-2 shrink-0 rounded-full bg-(--color-review)" />인식된 계단실에서 계단 {autoStairs}개를 만들었어요 — 단 수·오르는 방향을 확인해 주세요</p>
      ) : null}
      <div className="mt-2 grid grid-cols-2 items-end gap-3">
        <TextField label="층고" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)}
          onBlur={() => { const v = Number(h); if (v > 1.5 && v < 20) onPatch({ heightMm: Math.round(v * 1000) }); else setH(String(f.heightMm / 1000)); }}
          trailing={<span className="text-label text-ink-3">m</span>} hint={`바닥판 ${SLAB_MM}mm 포함`} />
        <Button variant="secondary" size="sm" onClick={onDrawStair}>계단 {f.stairs.length ? `${f.stairs.length}개 · 고치기` : autoStairs ? `${autoStairs}개 확인하기` : "그리기"}</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 text-label">
        {!sample ? <a href={`#job-${f.jobId}`} className="text-ink-3 underline-offset-4 hover:text-ink hover:underline">이 층 벽·문·창 고치기</a> : null}
        {dxf && job ? <a href={dxf} download={downloadName(job, "dxf")} className="text-ink-3 underline-offset-4 hover:text-ink hover:underline">.dxf 받기</a> : null}
        {!sample ? <button type="button" onClick={onRemove} className="text-danger underline-offset-4 hover:underline">층 빼기</button> : null}
      </div>
    </li>
  );
}

function AddFloor({ onAdded }: { onAdded: (j: Job) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  return (
    <div className="mt-3">
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_UPLOAD_MB * 1024 * 1024) return setErr(`파일이 너무 커요. ${MAX_UPLOAD_MB}MB 이하로 올려 주세요.`);
          setBusy(true); setErr(undefined);
          try { onAdded(await createJob(f)); } catch (x) { setErr(x instanceof ApiError ? x.message : "올리지 못했어요."); } finally { setBusy(false); }
        }} />
      <Button variant="secondary" block loading={busy} onClick={() => input.current?.click()}>위층 도면 올리기</Button>
      {err ? <p role="alert" className="mt-2 text-body-sm text-danger">{err}</p> : null}
    </div>
  );
}

/** 계단 그리기: 평면에서 끌어 사각형 → 단 수·오르는 방향 정하기 */
function StairEditor({ floor, risky, selected, setSelected, onChange, onClose, use, byKey }: {
  floor: FloorModel; risky: Set<string>; selected: string | null; setSelected: (s: string | null) => void;
  onChange: (s: Stair[]) => void; onClose: () => void; use: UseKey; byKey: Map<string, Finding>;
}) {
  const st = floor.stairs.find((s) => s.id === selected) ?? null;
  const std = STAIR_STD[use];
  const set = (p: Partial<Stair>) => st && onChange(floor.stairs.map((s) => (s.id === st.id ? { ...s, ...p } : s)));
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="stair-title" className="fixed inset-0 z-40 grid place-items-center bg-scrim p-4">
      <div className="grid max-h-full w-full max-w-5xl gap-6 overflow-auto bg-bg p-6 shadow-overlay lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h2 id="stair-title" className="text-title-sm font-semibold">{floor.name} 계단 그리기</h2>
          <p className="mt-1 text-body-sm text-ink-2">평면에서 계단 자리를 끌어 사각형으로 그려요. 다음 층 바닥까지 올라가는 곧은 계단으로 만들어요.</p>
          <div className="mt-4 aspect-4/3 border border-line bg-surface p-2">
            <PlanView plan={floor.plan} removed={new Set()} review={new Set()} selected={selected} onSelect={setSelected} stairs={floor.stairs} risky={risky}
              onDrawStair={(r) => {
                const id = nextStairId(floor);
                const alongX = Math.abs(r.x1 - r.x0) >= Math.abs(r.y1 - r.y0);
                const steps = Math.max(3, Math.ceil(floor.heightMm / std.riser)); // 기준 단높이를 넘지 않게
                onChange([...floor.stairs, { id, ...r, steps, dir: alongX ? (r.x1 >= r.x0 ? "x+" : "x-") : (r.y1 >= r.y0 ? "y+" : "y-") }]);
                setSelected(id);
              }} />
          </div>
        </div>
        <div className="space-y-4 lg:col-span-4">
          {st ? (
            <>
              <p className="text-body font-semibold">계단 {st.id}</p>
              <SpecList dense items={[
                { label: "폭", value: (stairDims(st).width / 1000).toFixed(2), unit: "m" },
                { label: "길이", value: (stairDims(st).run / 1000).toFixed(2), unit: "m" },
                { label: "단높이", value: Math.round(stairRiseTread(st, floor.heightMm).riser), unit: "mm" },
                { label: "단너비", value: Math.round(stairRiseTread(st, floor.heightMm).tread), unit: "mm" },
              ]} />
              <TextField label="단 수" inputMode="numeric" value={String(st.steps)}
                onChange={(e) => { const v = Number(e.target.value); if (v >= 2 && v <= 40) set({ steps: Math.round(v) }); }}
                hint={`${USE_LABEL[use]} 기준 단높이 ${std.riser}mm 이하 → ${Math.ceil(floor.heightMm / std.riser)}단 이상`} />
              <Select label="오르는 방향" value={st.dir} onChange={(e) => set({ dir: e.target.value as Stair["dir"] })}
                options={[{ value: "x+", label: "오른쪽으로" }, { value: "x-", label: "왼쪽으로" }, { value: "y+", label: "위쪽으로" }, { value: "y-", label: "아래쪽으로" }]} />
              {[...byKey.values()].filter((f) => f.floor === floor.index && f.elementId === st.id).map((f, i) => (
                <p key={i} className="text-body-sm text-danger">{f.title}: {f.measured} → {f.standard}</p>
              ))}
              <Button variant="danger" size="sm" onClick={() => { onChange(floor.stairs.filter((s) => s.id !== st.id)); setSelected(null); }}>이 계단 지우기</Button>
            </>
          ) : (
            <p className="text-body-sm text-ink-3">계단을 그리거나 눌러서 고르면 단 수와 방향을 정할 수 있어요.</p>
          )}
          <div className={cx("border-t border-line pt-4")}>
            <Button block onClick={onClose}>다 했어요</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 층마다 작업 상태를 불러오고, 아직 인식 중이면 따라간다 */
function useFloorJobs(ids: string[]) {
  const [jobs, setJobs] = useState<Record<string, Job | null>>({});
  const key = ids.join(",");
  useEffect(() => {
    let stop = false;
    const timers: number[] = [];
    const load = async (id: string, n = 0) => {
      try {
        const j = await getJob(id);
        if (stop) return;
        setJobs((m) => ({ ...m, [id]: j }));
        if (j.status === "queued" || j.status === "running") timers.push(window.setTimeout(() => load(id, n + 1), Math.min(3000, 800 + n * 200)));
      } catch {
        if (!stop) setJobs((m) => ({ ...m, [id]: null }));
      }
    };
    ids.forEach((id) => load(id));
    return () => { stop = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return jobs;
}

export { buildingHash, defaultFloorHeight };
