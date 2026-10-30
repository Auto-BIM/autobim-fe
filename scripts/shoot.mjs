#!/usr/bin/env node
// 화면 캡처 — 검수 단계(design-review 2장)에서 필수. 375(모바일)·1440(데스크톱)으로 첫 화면과 전체 페이지를 찍는다.
// 사용: node scripts/shoot.mjs <URL 또는 html 파일> [출력 폴더=.tmp/shots] [--reduced-motion]
// 결과: <폴더>/375-first.png, 375-full.png, 1440-first.png, 1440-full.png, axe-375.json, axe-1440.json
//   캡처는 움직임이 끝난 뒤(1.5초) 찍는다. --reduced-motion이면 움직임 줄이기 상태로 찍어 C19를 확인한다.
//   접근성 자동 검사(axe-core, WCAG 2.1 A·AA)를 화면 폭마다 돌린다. 위반이 있으면 종료 코드 1.
//   자동 검사는 일부만 잡는다(사진 위 글자 대비 등은 "확인 필요"로 남는다) — 캡처를 직접 보는 단계를 대신하지 않는다.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const reduced = args.includes("--reduced-motion");
const [target, outDir = ".tmp/shots"] = args.filter((a) => !a.startsWith("--"));
if (!target) { console.error("사용: node scripts/shoot.mjs <URL|파일> [출력 폴더]"); process.exit(1); }
const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(target)).href;
mkdirSync(outDir, { recursive: true });

const require = createRequire(import.meta.url);
let axePath = null;
try { axePath = require.resolve("axe-core/axe.min.js"); } catch { /* axe-core가 없으면 접근성 검사를 건너뛴다 */ }
let violationsTotal = 0;
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = await import("playwright")); }

export async function shoot(browser, setup) {
  violationsTotal = 0;
  for (const [w, h] of [[375, 812], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    if (setup) await setup(page);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: resolve(outDir, `${w}-first.png`) });
    let a11y = "  (axe-core 없음 — npm i -D axe-core)";
    if (axePath) {
      await page.addScriptTag({ path: axePath });
      const r = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }));
      writeFileSync(resolve(outDir, `axe-${w}.json`), JSON.stringify({ violations: r.violations, incomplete: r.incomplete.map((i) => ({ id: i.id, nodes: i.nodes.length })) }, null, 2));
      violationsTotal += r.violations.length;
      a11y = r.violations.length
        ? `  ✗ 접근성 ${r.violations.length}종: ${r.violations.map((v) => `${v.id}(${v.impact}, ${v.nodes.length}곳)`).join(", ")}`
        : `  접근성 위반 0 · 확인 필요 ${r.incomplete.length}종`;
    }
    // 전체 페이지: 아래로 한 번 내려가며 지연 요소(Reveal)를 깨운 뒤 찍는다
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.6) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: resolve(outDir, `${w}-full.png`), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log(`${w}px ✓${a11y}${overflow ? "  ✗ 가로 스크롤 있음 (C16)" : ""}${errors.length ? `  ✗ 오류: ${errors.join(" / ")}` : ""}`);
    await ctx.close();
  }
  return violationsTotal;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch();
  const v = await shoot(browser);
  await browser.close();
  console.log(`→ ${outDir}`);
  if (v) process.exit(1);
}
