#!/usr/bin/env node
// 빌드 전에 실행: 사이트와 함께 나가는 글꼴·라이브러리의 라이선스 전문을 한 파일로 모은다.
//   왜: 글꼴 파일(woff2)과 라이브러리 코드는 방문자 브라우저로 그대로 나간다 = 재배포.
//       SIL OFL 1.1(글꼴)과 MIT(라이브러리)는 사본에 저작권 표시와 라이선스 전문을 함께 두라고 한다.
//       빌드(압축)하면 코드 안의 @license 주석이 빠져서, 따로 모아 public/에 둔다 (풀스택 9장, design/CREDITS.md).
// 결과: public/licenses/THIRD_PARTY_LICENSES.txt → 배포하면 /licenses/THIRD_PARTY_LICENSES.txt
// 대상: package.json의 dependencies와 그 하위 의존성(실행에 쓰이는 것만). devDependencies는 사이트에 포함되지 않아 뺀다.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const seen = new Map();
const visit = (name) => {
  if (seen.has(name)) return;
  const dir = join(nm, name);
  if (!existsSync(join(dir, "package.json"))) return; // 선택 의존성 등 설치되지 않은 것
  const p = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  seen.set(name, { dir, version: p.version, license: typeof p.license === "string" ? p.license : p.license?.type ?? "확인 필요" });
  for (const d of Object.keys(p.dependencies ?? {})) visit(d);
};
Object.keys(pkg.dependencies ?? {}).forEach(visit);

const findLicense = (dir) => {
  for (const sub of ["", "dist"]) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    const f = readdirSync(d).find((n) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(n));
    if (f) return readFileSync(join(d, f), "utf8").trim();
  }
  return null;
};

const missing = [];
const parts = [...seen.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, { dir, version, license }]) => {
    const text = findLicense(dir);
    if (!text) missing.push(name);
    return `==============================================================================\n${name}@${version} — ${license}\n==============================================================================\n\n${text ?? "(라이선스 파일을 찾지 못함 — 패키지 저장소에서 확인)"}\n`;
  });

const head = `Auto-BIM 프론트엔드 — 함께 배포되는 글꼴·라이브러리의 라이선스\n(frontend/scripts/licenses.mjs가 빌드할 때 node_modules에서 모은다. 손으로 고치지 않는다.)\n\n`;
mkdirSync(join(root, "public", "licenses"), { recursive: true });
writeFileSync(join(root, "public", "licenses", "THIRD_PARTY_LICENSES.txt"), head + parts.join("\n"));
console.log(`licenses: ${seen.size}개 패키지 → public/licenses/THIRD_PARTY_LICENSES.txt`);
if (missing.length) {
  console.error(`licenses: 라이선스 파일이 없는 패키지 ${missing.join(", ")} — 확인 필요`);
  process.exit(1);
}
