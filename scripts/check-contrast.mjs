#!/usr/bin/env node
// 대비 검사 — tokens.css(또는 사이트의 덮어쓴 CSS)를 읽어 프리셋 4개 조합 + 아트 디렉션(v0.2)의 글자/부품 대비를 WCAG 2.2 기준으로 확인한다.
// 사용: node scripts/check-contrast.mjs [tokens.css 경로] [추가 CSS 경로...]
//   추가 CSS에 [data-preset] { --color-accent: #... } 처럼 사이트 강조색을 덮어쓴 파일을 넘기면 그것까지 검사한다.
// 종료 코드 1 = 기준 미달이 하나라도 있음.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const files = process.argv.slice(2);
if (files.length === 0) files.push(resolve(here, "../design/tokens.css"));
const css = files.map((f) => readFileSync(f, "utf8")).join("\n");

// --- 블록 파싱 -------------------------------------------------------------
function declsOf(body) {
  const out = {};
  for (const m of body.matchAll(/--color-([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
function blocks(selectorRe) {
  const out = {};
  for (const m of css.matchAll(new RegExp(selectorRe.source + String.raw`\s*\{([^}]*)\}`, "g"))) {
    Object.assign(out, declsOf(m[1]));
  }
  return out;
}
const themeBody = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const base = declsOf(themeBody);
const generic = blocks(/\[data-preset\](?!=)(?![^{]*\[data-mode)/);
const sel = {
  friendly: blocks(/\[data-preset="friendly"\](?!\[)/),
  friendlyDark: blocks(/\[data-preset="friendly"\]\[data-mode="dark"\](?:,\s*\[data-preset="friendly"\] \[data-mode="dark"\])?/),
  calm: blocks(/\[data-preset="calm"\](?!\[)/),
  calmDark: blocks(/\[data-preset="calm"\]\[data-mode="dark"\](?:,\s*\[data-preset="calm"\] \[data-mode="dark"\])?/),
};
const combos = {
  "friendly · light": { ...base, ...generic, ...sel.friendly },
  "friendly · dark": { ...base, ...generic, ...sel.friendly, ...sel.friendlyDark },
  "calm · light": { ...base, ...generic, ...sel.calm },
  "calm · dark": { ...base, ...generic, ...sel.calm, ...sel.calmDark },
};
// v0.2 아트 디렉션: [data-direction="x"] 블록이 있으면 그 위에 덮어쓴 조합도 검사한다
const directions = [...new Set([...css.matchAll(/\[data-direction="([a-z-]+)"\]/g)].map((m) => m[1]))];
for (const d of directions) {
  const light = blocks(new RegExp(String.raw`\[data-direction="${d}"\](?!\[|\s*,|\s+\[)`));
  if (!Object.keys(light).length) continue;
  combos[`${d} · light`] = { ...base, ...generic, ...sel.calm, ...light };
  const dark = blocks(new RegExp(String.raw`\[data-direction="${d}"\] \[data-mode="dark"\]`));
  if (Object.keys(dark).length) combos[`${d} · dark (섹션)`] = { ...base, ...generic, ...sel.calm, ...light, ...dark };
}

// --- 색 계산 ---------------------------------------------------------------
function resolveColor(tokens, name, depth = 0) {
  const v = tokens[name];
  if (!v || depth > 5) return null;
  const ref = v.match(/^var\(--color-([a-z0-9-]+)\)$/);
  if (ref) return resolveColor(tokens, ref[1], depth + 1);
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return hex[1];
  return null; // color-mix, rgb() 등은 검사 대상 아님
}
function lum(hex) {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [전경, 배경, 최소 대비, 설명]
const TEXT = 4.5, UI = 3;
const pairs = [
  ["ink", "bg", 7, "본문 (AAA 목표)"],
  ["ink", "surface", 7, "카드 위 본문"],
  ["ink", "surface-2", TEXT, "채움 위 본문"],
  ["ink-2", "bg", TEXT, "보조 글자"],
  ["ink-2", "surface", TEXT, "카드 위 보조 글자"],
  ["ink-3", "bg", TEXT, "메타·안내 글씨"],
  ["ink-3", "surface", TEXT, "카드 위 메타"],
  ["ink-3", "surface-2", TEXT, "채움 입력칸의 안내 글씨"],
  ["primary-ink", "primary", TEXT, "주 버튼 글자"],
  ["accent-ink", "accent", TEXT, "강조색 위 글자"],
  ["accent", "bg", TEXT, "강조색 글자(할인·링크)"],
  ["accent", "surface", TEXT, "카드 위 강조색 글자"],
  ["danger", "bg", TEXT, "오류 글자"],
  ["danger", "surface", TEXT, "카드 위 오류 글자"],
  ["success", "bg", TEXT, "성공 글자"],
  ["warning", "bg", TEXT, "주의 글자"],
  ["line-strong", "bg", UI, "입력칸 테두리"],
  ["line-strong", "surface", UI, "카드 위 입력칸 테두리"],
  ["focus", "bg", UI, "포커스 표시"],
  ["focus", "surface", UI, "카드 위 포커스 표시"],
  ["primary", "bg", UI, "주 버튼 경계"],
];

let failed = 0;
for (const [combo, tokens] of Object.entries(combos)) {
  console.log(`\n■ ${combo}`);
  for (const [fg, bg, min, label] of pairs) {
    const a = resolveColor(tokens, fg), b = resolveColor(tokens, bg);
    if (!a || !b) { console.log(`  ?  ${fg} / ${bg} — 계산 불가 (hex 아님)`); continue; }
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"}  ${r.toFixed(2).padStart(5)} ≥ ${min}  ${fg} / ${bg}  ${label}`);
  }
}
console.log(failed ? `\n기준 미달 ${failed}개` : "\n모두 통과");
process.exit(failed ? 1 : 0);
