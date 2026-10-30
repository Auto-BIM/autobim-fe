// 속성 패널 — 고른 벽·문·창의 값을 보여주고 고친다. 고친 값은 바로 서버로 가지 않고 "바뀔 내용"(초안)에 쌓인다.
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button, Select, TextField } from "@design";
import type { Opening, OpeningType, Plan, Wall, WallKind } from "./api";
import {
  DEFAULTS, KIND_LABEL, OPENING_LABEL, REASON_LABEL, elementName, findElement, mm, pct, reviewsById, wallLength,
} from "./plan";
import { patchOpening, patchWall, removeElement, restoreElement, toggleResolved, type Draft } from "./draft";

type Props = {
  plan: Plan; // 서버 결과 Plan (원래 값 비교용)
  preview: Plan; // 고칠 내용이 반영된 Plan (지금 보이는 값)
  draft: Draft;
  setDraft: (d: Draft) => void;
  id: string;
  onSelect: (id: string | null) => void;
};

/** mm 숫자 칸: 칸에서 벗어나거나 Enter를 누를 때 반영. 0 이하·숫자 아님은 오류로 보여주고 반영하지 않는다 */
function MmField({ label, value, onCommit, hint, min = 1 }: { label: string; value: number; onCommit: (v: number) => void; hint?: ReactNode; min?: number }) {
  const [text, setText] = useState(String(Math.round(value)));
  const [err, setErr] = useState<string>();
  useEffect(() => setText(String(Math.round(value))), [value]);
  const commit = () => {
    const v = Number(text.replace(/,/g, ""));
    if (!Number.isFinite(v) || v < min) {
      setErr(min > 0 ? "0보다 큰 숫자로 넣어 주세요" : "0 이상 숫자로 넣어 주세요");
      return;
    }
    setErr(undefined);
    if (Math.round(v) !== Math.round(value)) onCommit(v);
  };
  return (
    <TextField
      label={label}
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      trailing={<span className="text-label text-ink-3">mm</span>}
      hint={hint}
      error={err}
    />
  );
}

/** 원래 값과 같아지면 그 칸의 고칠 내용을 없앤다(되돌린 것) */
function setField<T extends Record<string, unknown>>(patch: T | undefined, key: string, v: unknown, orig: unknown) {
  const next = { ...(patch ?? {}) } as Record<string, unknown>;
  if (v === orig) delete next[key];
  else next[key] = v;
  return next;
}

export function Inspector({ plan, preview, draft, setDraft, id, onSelect }: Props) {
  const now = findElement(preview, id);
  const orig = findElement(plan, id);
  if (!now || !orig) return null;

  const reviews = reviewsById(plan).get(id) ?? [];
  const removed = draft.remove.includes(id) || (now.kind === "opening" && draft.remove.includes(now.el.wall_id));
  const resolved = draft.resolved.includes(id);

  const wallSet = (k: keyof Wall, v: unknown) => {
    const p = setField(draft.walls[id], k, v, (orig.el as Wall)[k]);
    const { [id]: _, ...rest } = draft.walls;
    setDraft(Object.keys(p).length ? patchWall({ ...draft, walls: rest }, id, p) : { ...draft, walls: rest });
  };
  const openingSet = (k: keyof Opening, v: unknown) => {
    const p = setField(draft.openings[id], k, v, (orig.el as Opening)[k]);
    const { [id]: _, ...rest } = draft.openings;
    setDraft(Object.keys(p).length ? patchOpening({ ...draft, openings: rest }, id, p) : { ...draft, openings: rest });
  };

  return (
    <section aria-labelledby="insp-title">
      {/* v0.2.1: 상자 없이 — 패널 안은 선과 여백으로 나눈다 (patterns C형 도구형) */}
      <header className="flex items-start justify-between gap-3">
        <div>
          {/* 종류는 제목 글꼴, ID는 본문 글꼴 숫자 — 제목 글꼴의 옛 숫자꼴에서 o3이 03처럼 읽혔다 */}
          <h3 id="insp-title" className="flex items-baseline gap-2">
            <span className="font-display text-title-lg tracking-title">{now.kind === "wall" ? KIND_LABEL[now.el.kind] : OPENING_LABEL[now.el.type]}</span>{" "}
            <span className="text-title tabular-nums text-ink-2">{now.el.id}</span>
          </h3>
          <p className="mt-1 text-label tabular-nums text-ink-3">인식 신뢰도 {pct(now.el.confidence)}</p>
        </div>
        <Button variant="text" size="sm" onClick={() => onSelect(null)}>닫기</Button>
      </header>

      {reviews.length ? (
        <ul className="mt-4 space-y-1 border-t border-line pt-3">
          {reviews.map((r, i) => (
            <li key={i} className="flex items-baseline gap-2 text-body-sm">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-(--color-review)" />
              <span>
                <span className="block text-ink">{REASON_LABEL[r.reason]}</span>
                {r.message ? <span className="block text-label text-ink-3">{r.message}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {removed ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-body-sm text-ink-2">지우기로 했어요. 적용하면 사라져요.</p>
          {draft.remove.includes(id) ? <Button variant="secondary" size="sm" onClick={() => setDraft(restoreElement(draft, id))}>되돌리기</Button> : null}
        </div>
      ) : (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {now.kind === "wall" ? (
            <>
              <Select
                label="종류"
                value={now.el.kind}
                onChange={(e) => wallSet("kind", e.target.value as WallKind)}
                options={(Object.keys(KIND_LABEL) as WallKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <MmField label="두께" value={now.el.thickness} onCommit={(v) => wallSet("thickness", v)} hint={`기본 외벽 ${DEFAULTS.exterior_wall_thickness} · 내벽 ${DEFAULTS.interior_wall_thickness}`} />
                <MmField label="높이" value={now.el.height} onCommit={(v) => wallSet("height", v)} hint={`기본 ${mm(DEFAULTS.wall_height)}`} />
              </div>
              <ScaleFromWall wall={now.el} draft={draft} setDraft={setDraft} />
              <div className="flex flex-wrap gap-2">
                {(["door", "window"] as OpeningType[]).map((t) => (
                  <Button
                    key={t}
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setDraft({ ...draft, addOpenings: [...draft.addOpenings, { type: t, wall_id: id, position: Math.round(wallLength(now.el as Wall) / 2) }] })
                    }
                  >
                    가운데에 {OPENING_LABEL[t]} 추가
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Select
                label="종류"
                value={now.el.type}
                onChange={(e) => {
                  // 종류만 바꾸면 크기는 그대로라(백엔드 규칙), 기본 크기도 함께 바꿔 준다
                  const t = e.target.value as OpeningType;
                  const d = DEFAULTS[t];
                  const o = orig.el as Opening;
                  const p = { type: t, width: d.width, height: d.height, sill_height: d.sill_height };
                  const changed = Object.fromEntries(Object.entries(p).filter(([k, v]) => o[k as keyof Opening] !== v));
                  const { [id]: _, ...rest } = draft.openings;
                  setDraft(Object.keys(changed).length ? patchOpening({ ...draft, openings: rest }, id, changed) : { ...draft, openings: rest });
                }}
                options={(Object.keys(OPENING_LABEL) as OpeningType[]).map((k) => ({ value: k, label: OPENING_LABEL[k] }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <MmField label="폭" value={now.el.width} onCommit={(v) => openingSet("width", v)} hint={`기본 ${mm(DEFAULTS[now.el.type].width)}`} />
                <MmField label="높이" value={now.el.height} onCommit={(v) => openingSet("height", v)} hint={`기본 ${mm(DEFAULTS[now.el.type].height)}`} />
                <MmField label="창대 높이" min={0} value={now.el.sill_height} onCommit={(v) => openingSet("sill_height", v)} hint={now.el.type === "door" ? "문은 0" : `기본 ${mm(DEFAULTS.window.sill_height)}`} />
                <MmField label="위치" min={0} value={now.el.position} onCommit={(v) => openingSet("position", v)} hint="벽 시작점 → 가운데" />
              </div>
              <p className="text-label text-ink-3">
                붙은 벽:{" "}
                <button type="button" className="underline underline-offset-4 hover:text-ink" onClick={() => onSelect(now.el.wall_id)}>
                  {elementName(findElement(plan, now.el.wall_id), now.el.wall_id)}
                </button>
              </p>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            {reviews.length ? (
              <Button variant="secondary" size="sm" aria-pressed={resolved} onClick={() => setDraft(toggleResolved(draft, id))}>
                {resolved ? "확인 완료 취소" : "맞아요, 확인했어요"}
              </Button>
            ) : <span />}
            <Button variant="danger" size="sm" onClick={() => setDraft(removeElement(plan, draft, id))}>
              지우기
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** 이 벽의 실제 길이를 알면 그 길이로 도면 전체 크기를 맞춘다(scale.reference) */
function ScaleFromWall({ wall, draft, setDraft }: { wall: Wall; draft: Draft; setDraft: (d: Draft) => void }) {
  const cur = draft.scale && "reference" in draft.scale && draft.scale.reference.wall_id === wall.id ? draft.scale.reference.length_mm : null;
  const [text, setText] = useState(cur ? String(cur) : "");
  const [err, setErr] = useState<string>();
  return (
    <div className="space-y-2">
      <p className="text-body-sm text-ink-2">
        지금 길이 <span className="tabular-nums text-ink">{mm(wallLength(wall))}</span> mm
      </p>
      <TextField
        label="실제 길이를 알면"
        optional
        inputMode="numeric"
        placeholder="예: 8000"
        value={text}
        onChange={(e) => setText(e.target.value)}
        trailing={<span className="text-label text-ink-3">mm</span>}
        hint="넣으면 이 벽을 기준으로 도면 전체 크기를 맞춰요"
        error={err}
        onBlur={() => {
          if (!text.trim()) return;
          const v = Number(text.replace(/,/g, ""));
          if (!Number.isFinite(v) || v <= 0) return setErr("0보다 큰 숫자로 넣어 주세요");
          setErr(undefined);
          setDraft({ ...draft, scale: { reference: { wall_id: wall.id, length_mm: v } } });
        }}
      />
      {cur ? <Badge tone="accent">적용하면 이 길이로 크기를 맞춰요</Badge> : null}
    </div>
  );
}
