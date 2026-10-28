// 작업 화면 — 인식 결과를 보고(3D·평면), 확인 필요 요소를 고치고, 적용해 다시 만들고, 파일을 받는다.
//
// 데이터 흐름 (한 방향):
//   job.plan (서버 결과) ─┬─▶ previewPlan(plan, draft) ─▶ 평면·속성 패널 (고칠 내용 미리보기)
//                        └─▶ 3D (서버가 만든 glb — 적용해야 바뀐다)
//   사용자가 고친 것 ─▶ draft ─(적용)─▶ POST /supplement ─▶ revision+1 ─▶ 폴링 ─▶ 새 job.plan·glb
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Badge, Button, SpecList, Tabs, TextField, cx, useToast } from "@design";
import { ApiError, downloadName, fileUrl, supplement, type Job, type Plan } from "./api";
import { PlanView } from "./PlanView";
import { Inspector } from "./Inspector";
import {
  OPENING_LABEL, REASON_LABEL, SCALE_LABEL, buildingWidthMm, elementName, findElement, mm, planBounds,
} from "./plan";
import { changeCount, changeList, emptyDraft, previewPlan, removedSet, toRequest, type Draft } from "./draft";

// three.js는 무거워서(약 600KB) 이 화면에서만 불러온다
const Viewer3D = lazy(() => import("./Viewer3D").then((m) => ({ default: m.Viewer3D })));

type Props = { job: Job; busy: boolean; track: (j: Job) => void; onRestart: () => void; onBuilding?: () => void };

export function Workspace({ job, busy, track, onRestart, onBuilding }: Props) {
  const plan = job.plan as Plan; // result_revision이 있으면 plan도 있다
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"3d" | "plan">("3d");
  const [applyErr, setApplyErr] = useState<string>();
  const [sending, setSending] = useState(false);
  const [viewerErr, setViewerErr] = useState<string>();

  const preview = useMemo(() => previewPlan(plan, draft), [plan, draft]);
  const removed = useMemo(() => removedSet(plan, draft), [plan, draft]);
  const reviewIds = useMemo(
    () => new Set(preview.review_items.map((r) => r.element_id).filter((id) => !draft.resolved.includes(id))),
    [preview, draft.resolved],
  );
  const changes = useMemo(() => changeList(plan, draft), [plan, draft]);
  const pending = changeCount(draft);
  const rebuilding = job.result_revision !== job.revision; // 다시 만드는 중이거나, 마지막 적용이 실패함

  // 새 결과가 오면: 사라진 요소를 고르고 있었다면 고르기 해제
  useEffect(() => {
    if (selected && !findElement(plan, selected)) setSelected(null);
  }, [plan, selected]);

  const apply = async () => {
    setApplyErr(undefined);
    setSending(true);
    try {
      const next = await supplement(job.id, toRequest(draft));
      setDraft(emptyDraft()); // 서버가 받아들였으면(202) 초안은 비운다 — 이제 서버 기록에 쌓였다
      track(next);
      // 벽과 함께 지워진 문·창 알려 주기
      const cascade = next.removed.filter((r) => r.revision === next.revision && r.cascade_from);
      if (cascade.length) toast({ message: `${cascade.map((r) => r.id).join(", ")}도 벽과 함께 지워져요` });
    } catch (e) {
      setApplyErr(e instanceof ApiError ? e.message : "적용하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  const glb = fileUrl(job, "glb");
  const b = planBounds(plan);
  const doors = plan.openings.filter((o) => o.type === "door").length;
  const planItems = preview.review_items.filter((r) => r.element_id === "plan" || r.element_kind === "dimension");
  const elementItems = preview.review_items.filter((r) => r.element_id !== "plan" && r.element_kind !== "dimension");

  return (
    <div className="pt-8">
      {/* 제목 줄: 파일 이름 · 리비전 · 받기 */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-6">
        <div className="min-w-0">
          <p className="eyebrow mb-2">인식 결과 · 리비전 {job.result_revision}</p>
          <h1 className="truncate text-display-sm font-display tracking-display">{job.input.filename}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["dxf", "glb", "json"] as const).map((k) => {
            const u = fileUrl(job, k);
            // 고칠 내용이 남아 있으면 주 버튼은 "적용"이므로 받기는 보조 버튼으로 (한 화면에 주 버튼 하나)
            const primary = k === "dxf" && pending === 0;
            return u ? (
              <Button key={k} href={u} download={downloadName(job, k)} variant={primary ? "primary" : "secondary"}>
                .{k} 받기
                {k === "dxf" ? <span className={cx("text-label", primary ? "opacity-80" : "text-ink-3")}>벽별 블록</span> : null}
              </Button>
            ) : null;
          })}
          {onBuilding ? <Button variant="secondary" onClick={onBuilding}>건물로 보기 · 위층 추가</Button> : null}
          <Button variant="text" onClick={onRestart}>다른 도면</Button>
        </div>
      </div>

      {/* 다시 만드는 중 / 마지막 적용 실패 */}
      {rebuilding ? (
        <p role="status" className={cx("mt-4 border px-4 py-3 text-body-sm", job.status === "failed" ? "border-danger text-danger" : "border-line bg-surface text-ink-2")}>
          {job.status === "failed"
            ? `리비전 ${job.revision}을 만들지 못했어요 — ${job.error?.message ?? ""}. 지금 보이는 것은 리비전 ${job.result_revision} 결과예요.`
            : `리비전 ${job.revision}을 만드는 중이에요. 끝날 때까지 리비전 ${job.result_revision}을 보여 줘요.`}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* 왼쪽: 3D · 평면 */}
        <section className="min-w-0 lg:col-span-8">
          <Tabs
            label="보기"
            value={tab}
            onChange={(v) => setTab(v as "3d" | "plan")}
            items={[
              {
                id: "3d",
                label: "3D",
                content: (
                  <div className="aspect-4/3 border border-line">
                    {glb && !viewerErr ? (
                      <Suspense fallback={<div className="size-full bg-surface-2" />}>
                        <Viewer3D
                          url={glb}
                          plan={plan}
                          selected={selected}
                          review={reviewIds}
                          onSelect={setSelected}
                          onError={setViewerErr}
                          overlay={busy ? `리비전 ${job.revision} 만드는 중…` : pending ? "고친 내용은 평면에 먼저 보이고, 3D는 적용하면 바뀌어요" : null}
                        />
                      </Suspense>
                    ) : (
                      <p className="grid size-full place-items-center p-6 text-center text-body-sm text-ink-3">{viewerErr ?? "3D 파일이 없어요."}</p>
                    )}
                  </div>
                ),
              },
              {
                id: "plan",
                label: "평면",
                count: pending || undefined,
                content: (
                  <div className="aspect-4/3 border border-line bg-surface p-2">
                    <PlanView plan={preview} removed={removed} review={reviewIds} selected={selected} onSelect={setSelected} />
                  </div>
                ),
              },
            ]}
          />
          <Legend />
          <SpecList
            dense
            className="mt-6"
            items={[
              { label: "크기", value: `${(b.w / 1000).toFixed(2)} × ${(b.h / 1000).toFixed(2)}`, unit: "m" },
              { label: "벽", value: plan.walls.length, unit: "개" },
              { label: "문 · 창", value: `${doors} · ${plan.openings.length - doors}`, unit: "개" },
              { label: "축척", value: SCALE_LABEL[plan.scale.source], note: plan.scale.estimated ? "추정값 — 오른쪽에서 맞출 수 있어요" : undefined },
            ]}
          />
        </section>

        {/* 오른쪽: 크기 · 고른 요소 · 확인 필요 · 바뀔 내용 */}
        <aside className="min-w-0 space-y-6 lg:col-span-4">
          <ScalePanel plan={plan} draft={draft} setDraft={setDraft} items={planItems} />

          {selected ? (
            <Inspector plan={plan} preview={preview} draft={draft} setDraft={setDraft} id={selected} onSelect={setSelected} />
          ) : (
            <p className="border border-dashed border-line px-4 py-5 text-body-sm text-ink-3">3D나 평면에서 벽·문·창을 누르면 여기서 값을 고칠 수 있어요.</p>
          )}

          <section aria-labelledby="review-title">
            <h2 id="review-title" className="flex items-baseline justify-between text-body font-semibold">
              확인 필요 <span className="text-label font-normal text-ink-3">{elementItems.filter((r) => !draft.resolved.includes(r.element_id)).length}개 남음</span>
            </h2>
            {elementItems.length ? (
              <ul className="mt-2 border-t border-line">
                {elementItems.map((r, i) => {
                  const done = draft.resolved.includes(r.element_id);
                  return (
                    <li key={`${r.element_id}-${i}`} className="border-b border-line">
                      <button
                        type="button"
                        onClick={() => setSelected(r.element_id)}
                        aria-pressed={selected === r.element_id}
                        className={cx("flex w-full items-baseline gap-3 py-3 text-left hover:bg-surface-2 aria-pressed:bg-surface-2", done && "text-ink-3")}
                      >
                        <span aria-hidden className={cx("size-2 shrink-0 rounded-full", done ? "bg-line-strong" : "bg-(--color-review)")} />
                        <span className="min-w-0 flex-1">
                          <span className={cx("block text-body-sm font-medium", done && "line-through")}>{elementName(findElement(plan, r.element_id), r.element_id)}</span>
                          <span className="block text-label text-ink-3">{REASON_LABEL[r.reason]} · 신뢰도 {Math.round(r.confidence * 100)}%</span>
                        </span>
                        {done ? <Badge>확인함</Badge> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-body-sm text-ink-3">확인할 요소가 없어요.</p>
            )}
          </section>

          <section aria-labelledby="changes-title" className="border-t border-ink pt-4">
            <h2 id="changes-title" className="text-body font-semibold">
              바뀔 내용 <span className="text-label font-normal text-ink-3">{pending}개</span>
            </h2>
            {changes.length ? (
              <ul className="mt-2 space-y-1">
                {changes.map((c) => (
                  <li key={c.key} className="flex items-baseline justify-between gap-3 text-body-sm">
                    <span className="text-ink-2">{c.text}</span>
                    <button type="button" className="shrink-0 text-label text-ink-3 underline-offset-4 hover:text-ink hover:underline" onClick={() => setDraft(c.undo(draft))}>
                      되돌리기
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-body-sm text-ink-3">고친 내용이 없어요. 고친 뒤 한 번에 적용해요.</p>
            )}
            {applyErr ? <p className="mt-3 text-body-sm text-danger" role="alert">{applyErr}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button
                onClick={apply}
                loading={sending}
                disabledReason={busy ? "다시 만드는 중이에요" : !pending ? "고친 내용이 없어요" : undefined}
                className="flex-1"
              >
                {busy ? "만드는 중…" : `적용해서 다시 만들기${pending ? ` (${pending})` : ""}`}
              </Button>
              {pending ? <Button variant="secondary" onClick={() => setDraft(emptyDraft())}>모두 취소</Button> : null}
            </div>
            <p className="mt-2 text-label text-ink-3">인식을 다시 하지 않고, 고친 값으로 3D와 .dxf만 다시 만들어요.</p>
          </section>

          <AllElements plan={plan} removed={removed} selected={selected} onSelect={setSelected} />
        </aside>
      </div>
    </div>
  );
}

/** 색 약속 — 2D·3D가 같은 색을 쓴다 */
function Legend() {
  const items: [string, string, boolean?][] = [
    ["외벽", "bg-(--color-wall-ext)"],
    ["내벽", "bg-(--color-wall)"],
    ["문", "bg-(--color-door)"],
    ["창", "bg-(--color-window)"],
    ["확인 필요", "border-2 border-dashed border-(--color-review)", true],
    ["고른 것", "border-2 border-accent", true],
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-label text-ink-3" aria-label="색 설명">
      {items.map(([t, c]) => (
        <li key={t} className="flex items-center gap-2">
          <span aria-hidden className={cx("size-3", c)} />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** 축척 — 추정이면 눈에 띄게, 건물 가로 길이로 맞추기 */
function ScalePanel({ plan, draft, setDraft, items }: { plan: Plan; draft: Draft; setDraft: (d: Draft) => void; items: Plan["review_items"] }) {
  const cur = draft.scale && "building_width_mm" in draft.scale ? draft.scale.building_width_mm : null;
  const [text, setText] = useState(cur ? String(cur / 1000) : "");
  const [err, setErr] = useState<string>();
  const est = plan.scale.estimated;
  const now = buildingWidthMm(plan);
  return (
    <section aria-labelledby="scale-title" className={cx("border px-4 py-4", est ? "border-(--color-review) bg-surface" : "border-line")}>
      <h2 id="scale-title" className="text-body font-semibold">{est ? "실제 크기를 추정했어요" : "실제 크기"}</h2>
      <p className="mt-1 text-body-sm text-ink-2">
        {SCALE_LABEL[plan.scale.source]}. 지금 건물 가로 길이는 <span className="tabular-nums text-ink">{(now / 1000).toFixed(2)} m</span>예요.
        {est ? " 실제 길이를 알면 넣어 주세요 — 모든 치수가 그에 맞게 바뀌어요." : ""}
      </p>
      {items.map((r, i) => (
        <p key={i} className="mt-1 text-label text-ink-3">{REASON_LABEL[r.reason]}{r.message ? ` — ${r.message}` : ""}</p>
      ))}
      <form
        className="mt-3 flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(text.replace(/,/g, ""));
          if (!Number.isFinite(v) || v <= 0) return setErr("0보다 큰 숫자로 넣어 주세요");
          setErr(undefined);
          // 사람은 m로 넣고, 서버에는 mm로 보낸다
          setDraft({ ...draft, scale: { building_width_mm: Math.round(v * 1000) } });
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="건물 가로 길이"
            hideLabel
            inputMode="decimal"
            placeholder={`예: ${(now / 1000).toFixed(1)}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            trailing={<span className="text-label text-ink-3">m</span>}
            error={err}
            hint="가장 바깥 벽 중심선 사이, 가로 방향"
          />
        </div>
        <Button type="submit" variant="secondary">맞추기</Button>
      </form>
      {cur ? <p className="mt-2 text-label text-accent">적용하면 가로 {mm(cur)} mm로 맞춰요</p> : null}
    </section>
  );
}

/** 모든 요소 — 3D·평면을 쓰기 어려울 때(키보드 등) 목록으로 고르기 */
function AllElements({ plan, removed, selected, onSelect }: { plan: Plan; removed: Set<string>; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <details className="border-t border-line pt-4">
      <summary className="cursor-pointer text-body-sm font-medium text-ink-2 hover:text-ink">
        모든 벽·문·창 ({plan.walls.length + plan.openings.length})
      </summary>
      <ul className="mt-2 grid grid-cols-2 gap-1">
        {[...plan.walls.map((w) => ({ id: w.id, t: elementName({ kind: "wall", el: w }) })), ...plan.openings.map((o) => ({ id: o.id, t: `${OPENING_LABEL[o.type]} ${o.id}` }))].map((x) => (
          <li key={x.id}>
            <button
              type="button"
              onClick={() => onSelect(x.id)}
              aria-pressed={selected === x.id}
              className={cx("w-full px-2 py-1.5 text-left text-body-sm hover:bg-surface-2 aria-pressed:bg-ink aria-pressed:text-bg", removed.has(x.id) && "text-ink-3 line-through")}
            >
              {x.t}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
