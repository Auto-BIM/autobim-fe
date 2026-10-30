#!/usr/bin/env node
// 디자인 자동 검사 (v0.2) — design-review 1장의 grep 점검을 한 번에 돌리고, 실패하면 종료 코드 1.
// 사용: node scripts/design-lint.mjs [파일·폴더 ...] [--release] [--dist <빌드 폴더>]
//   기본 대상: app/ src/ examples/ (+ 프론트가 하위 폴더인 저장소: frontend/app·frontend/src) 중 있는 것
//   (design/components는 부품이라 제외 — 부품의 임의 값은 머리말에 이유를 적는다)
//   --release : 출시·납품 전. 시안 소재("납품 전 교체")와 ImagePlaceholder가 남아 있으면 실패 (C22)
//   --dist    : 빌드 결과 폴더. 글꼴 파일 옆에 라이선스 파일이 있는지 확인 (OFL 조건)
// 이 스크립트는 "틀린 것"만 찾는다. "잘된 것"(품질 기준표 Q1~Q5)은 캡처를 보고 사람이·AI가 매긴다.
// 예외 두 가지 (보고서에 "참고"로 남는다)
//   - CSS의 사용자 정의 속성 정의 줄(`--color-wall: #…;`)은 C8에서 뺀다 — 사이트 테마 파일은 값을 "정하는" 곳이다.
//   - 파일 안에 `design-lint-disable C8: <이유>` 주석이 있으면 그 파일의 C8을 건너뛴다(3D·캔버스 엔진처럼 화면 클래스가 아닌 그림 코드). 이유가 없으면 무시한다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
const release = args.includes("--release");
const distIdx = args.indexOf("--dist");
const dist = distIdx >= 0 ? args[distIdx + 1] : null;
const targets = args.filter((a, i) => !a.startsWith("--") && !(distIdx >= 0 && i === distIdx + 1));
const roots = targets.length ? targets : ["app", "src", "examples", "frontend/app", "frontend/src"].filter((p) => existsSync(p));
// 디자인 값·부품·도구 자체는 검사 대상이 아니다 (값을 정의하는 곳이므로)
const SKIP = /(^|\/)(node_modules|dist|\.next|\.tmp|\.git|\.claude|design|scripts|styleguide)(\/|$)/;
const CODE = new Set([".tsx", ".jsx", ".ts", ".js", ".css", ".html", ".vue", ".svelte"]);

// 넘겨받은 폴더 자체는 검사하고, 그 안의 node_modules·dist 등만 건너뛴다
function walk(p, out = [], base = p) {
  if (!existsSync(p) || (p !== base && SKIP.test(relative(base, p)))) return out;
  const st = statSync(p);
  if (st.isDirectory()) for (const f of readdirSync(p)) walk(join(p, f), out, base);
  else out.push(p);
  return out;
}
const files = roots.flatMap((r) => walk(r));
const code = files.filter((f) => CODE.has(extname(f)));
const credits = files.filter((f) => /CREDITS\.md$/i.test(f));

const results = []; // { id, level: "fail"|"warn"|"info", where, text, fix }
const add = (id, level, where, text, fix) => results.push({ id, level, where, text, fix });

const RULES = [
  {
    id: "C8",
    name: "날것의 색·임의 값",
    re: /\[[0-9.]+px\]|(?<![\w/&])#[0-9a-fA-F]{6}\b|(?<![\w/&])#[0-9a-fA-F]{3}\b(?![\w-])|rgba?\(|(?:text|bg|border|ring|fill|stroke)-(?:red|blue|green|gray|grey|neutral|zinc|slate|stone|black|white|yellow|orange|purple|pink|indigo)(?:-\d+)?\b/,
    fix: "tokens.css의 역할 이름(bg·ink·accent…)과 단계(text-body…)로 바꾼다",
    skipLine: (l) => /href=["'{]?#|^\s*(\/\/|\*|\/\*)/.test(l),
  },
  {
    id: "C8",
    name: "페이지 안 임의 Tailwind 값",
    re: /className=[^>]*?(?:\w-\[[^\]]+\]|\s\[[a-z-]+:[^\]]+\])/,
    fix: "필요하면 부품을 만들고 머리말에 이유를 적거나 tokens.css에 역할 이름으로 추가한다",
    onlyExt: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
  },
  { id: "C10", name: "12px 미만 글자", re: /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]|font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/, fix: "text-caption(12) 이상. 영문 대문자 라벨만 micro-label(11)" },
  { id: "C18", name: "해요체 아닌 문장", re: /(습니다|합니다|입니다|하십시오|해라|했다|한다)[.!?"'<]/, fix: "해요체로 (\"저장했어요\")", skipLine: (l) => /^\s*(\/\/|\*|\/\*)/.test(l) },
  { id: "C20", name: "외부 이미지·영상·글꼴 주소", re: /https?:\/\/[^"'\s)]+\.(?:png|jpe?g|webp|avif|gif|svg|mp4|webm|woff2?|ttf|otf)\b/i, fix: "직접 만들었거나 라이선스가 확인된 파일을 저장소에 두고 CREDITS에 적는다" },
  { id: "C23", name: "micro-label에 한글", re: /micro-label[^"'`]*["'`][^>]*>\s*[^<{]*[가-힣]/, fix: "영문 대문자 라벨만 micro(11px). 한글은 eyebrow·label(13px)" },
];

for (const f of code) {
  const lines = readFileSync(f, "utf8").split("\n");
  const ext = extname(f);
  const off = lines.join("\n").match(/design-lint-disable C8:\s*(\S[^*\n]*)/);
  if (off) add("C8", "info", f, `C8 건너뜀 — ${off[1].trim()}`, "그림 코드의 색은 CSS 변수에서 읽고, 코드 값은 기본값으로만");
  lines.forEach((line, i) => {
    for (const r of RULES) {
      if (r.onlyExt && !r.onlyExt.includes(ext)) continue;
      if (r.skipLine?.(line)) continue;
      if (r.id === "C8" && off) continue;
      if (r.id === "C8" && ext === ".css" && /^\s*--[a-z0-9-]+\s*:/.test(line)) continue;
      if (r.re.test(line)) add(r.id, "fail", `${f}:${i + 1}`, `${r.name}: ${line.trim().slice(0, 110)}`, r.fix);
    }
  });
  if ([".tsx", ".jsx"].includes(ext)) {
    const text = lines.join("\n");
    // C4 주 버튼: variant를 안 쓴 <Button>도 primary다. 한 화면 1개 + 긴 페이지 끝 반복 1회까지
    const primaries = [...text.matchAll(/<Button\b(?![^>]*variant=["'](?:secondary|text|danger)["'])[^>]*>/g)].length;
    if (primaries > 2) add("C4", "warn", f, `주 버튼 후보 ${primaries}개`, "화면당 1개(+ 끝 반복 1회). 나머지는 variant=\"secondary\"");
    // C9 강조색 쓰임 — 개수만 알려 준다(한 가지 의미인지는 사람이 확인)
    const accents = [...text.matchAll(/\b(?:text|bg|border|ring|fill|stroke)-accent\b/g)].length;
    if (accents) add("C9", "info", f, `강조색 ${accents}곳`, "모두 같은 한 가지 의미인지 확인");
    if (release && /<ImagePlaceholder\b/.test(text)) add("C22", "fail", f, "ImagePlaceholder가 남아 있음", "실제 소재로 바꾼다");
  }
}

// C22 시안 소재
for (const f of credits) {
  const t = readFileSync(f, "utf8");
  if (/납품 전 교체|시안용/.test(t)) {
    add("C22", release ? "fail" : "info", f, release ? "시안 소재가 남아 있음" : "시안 소재 있음 (출시 전 교체)", "실제 사진으로 바꾸고 CREDITS를 고친다");
  }
}
if (!credits.length && files.some((f) => /\.(png|jpe?g|webp|avif|svg|mp4|mp3|wav)$/i.test(f))) {
  add("C20", "fail", roots.join(" "), "이미지·소리 파일이 있는데 CREDITS.md가 없음", "파일마다 출처·라이선스를 CREDITS.md에 적는다");
}

// 글꼴 라이선스 동봉 — 글꼴 파일 옆의 LICENSE·OFL 파일, 또는 빌드 결과 맨 위의 라이선스 모음
//   (licenses/ 폴더나 *LICENSES* 파일 — scripts/licenses.mjs가 만드는 것)에 그 글꼴 이름과 OFL 전문이 있으면 통과.
//   번들러는 글꼴을 assets/에 해시 이름으로 섞어 두므로 "옆에" 두기 어렵다 → 모음 파일도 인정한다.
if (dist) {
  const top = resolve(dist);
  const collected = [
    ...readdirSync(top).filter((n) => /^(LICENSE|OFL)|LICENSES/i.test(n)).map((n) => join(top, n)),
    ...(existsSync(join(top, "licenses")) ? walk(join(top, "licenses")) : []),
  ].filter((f) => statSync(f).isFile()).map((f) => readFileSync(f, "utf8").toLowerCase()).join("\n");
  const hasOfl = collected.includes("open font license");
  for (const f of walk(top)) {
    if (!/\.(woff2?|ttf|otf)$/i.test(f)) continue;
    const dir = f.slice(0, f.lastIndexOf("/"));
    if (readdirSync(dir).some((n) => /^(LICENSE|OFL)/i.test(n))) continue;
    // 파일 이름에서 글꼴 이름 후보: noto-serif-kr-latin-400-normal-AbC.woff2 → noto-serif-kr · PretendardVariable.subset.0 → pretendard
    const base = f.slice(f.lastIndexOf("/") + 1).replace(/\.(woff2?|ttf|otf)$/i, "");
    const words = base.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const keys = [words.slice(0, 3).join("-"), words.slice(0, 2).join("-"), words[0]].filter((k) => k && k.length >= 4);
    const named = keys.some((k) => collected.includes(k) || collected.includes(k.replace(/-/g, " ")));
    if (!(hasOfl && named)) add("LIC", "fail", relative(process.cwd(), f), "글꼴 파일의 라이선스 전문을 찾지 못함", "글꼴 옆에 OFL 등 라이선스 파일을 두거나, scripts/licenses.mjs로 빌드 결과 licenses/에 모은다");
  }
}

// ---- 보고 ----
const mark = { fail: "✗", warn: "!", info: "·" };
for (const r of results) console.log(`${mark[r.level]} ${r.id.padEnd(4)} ${r.where}\n       ${r.text}\n       → ${r.fix}`);
const n = (lv) => results.filter((r) => r.level === lv).length;
console.log(`\n검사한 파일 ${code.length}개 · 실패 ${n("fail")} · 주의 ${n("warn")} · 참고 ${n("info")}${release ? " · 출시 모드" : ""}`);
if (!code.length) console.log("검사할 파일이 없어요. 대상 폴더를 넘겨 주세요: node scripts/design-lint.mjs app");
process.exit(n("fail") ? 1 : 0);
