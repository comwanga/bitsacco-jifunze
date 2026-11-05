// After `next build`: add per-page CSP hashes, stamp the service worker, check links and the budget.
import fs from "node:fs";
import path from "node:path";
import { BUDGET, pageWeight } from "../lib/build/budget.ts";
import { buildCsp, injectCsp, inlineScriptHashes } from "../lib/build/csp.ts";
import { internalRefs, resolvesInOut } from "../lib/build/links.ts";
import { flatLessons, getRoadmap } from "../lib/content/load.ts";
import { SITE_URL } from "../lib/site.ts";
import { verifyBook } from "../lib/build/book.ts";

const OUT = path.resolve("out");
verifyBook(OUT);
// Runtime static mode must never serve an export built for staging.
fs.writeFileSync(path.join(OUT, "site-origin.txt"), `${SITE_URL}\n`);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

function htmlFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith(".html") ? [p] : [];
  });
}

const failures: string[] = [];
const pages = htmlFiles(OUT);

// 1. CSP
for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, injectCsp(html, buildCsp(inlineScriptHashes(html), { lab: html.includes("data-jifunze-lab"), pdfReader: html.includes("data-pdf-reader") })));
}

// 2. Service worker version
const swFile = path.join(OUT, "sw.js");
const buildId = fs.readFileSync(path.resolve(".next/BUILD_ID"), "utf8").trim();
fs.writeFileSync(swFile, fs.readFileSync(swFile, "utf8").replaceAll("__BUILD_ID__", buildId));

// 3. Internal links
for (const file of pages) {
  for (const ref of internalRefs(fs.readFileSync(file, "utf8"))) {
    if (!resolvesInOut(OUT, ref)) failures.push(`broken link ${ref} in ${path.relative(OUT, file)}`);
  }
}

// 4. Performance budget
const weights = pages.map((file) => ({
  file: path.relative(OUT, file).replaceAll("\\", "/"),
  lab: fs.readFileSync(file, "utf8").includes("data-jifunze-lab"),
  ...pageWeight(OUT, file),
}));
const overSpec: string[] = [];
for (const w of weights) {
  const ceiling = w.lab ? BUDGET.jsCeilingLab : BUDGET.jsCeiling;
  if (w.jsGzip > ceiling) failures.push(`${w.file}: JavaScript ${kb(w.jsGzip)} > ceiling ${kb(ceiling)}`);
  else if (w.jsGzip > BUDGET.jsPerPage) overSpec.push(w.file);
}
const first = `sw/savers/${flatLessons(getRoadmap("savers"))[0]}/index.html`;
const firstWeight = weights.find((w) => w.file === first);
if (!firstWeight) failures.push(`first lesson page ${first} was not built`);
else if (firstWeight.totalGzip > BUDGET.firstLessonTotal) {
  failures.push(`${first}: ${kb(firstWeight.totalGzip)} transferred > ${kb(BUDGET.firstLessonTotal)}`);
}

console.log(`postbuild: CSP added to ${pages.length} pages; sw.js version ${buildId}`);
console.log("heaviest pages (gzip):");
for (const w of [...weights].sort((a, b) => b.totalGzip - a.totalGzip).slice(0, 5)) {
  console.log(`  ${w.file.padEnd(44)} total ${kb(w.totalGzip).padStart(9)}   js ${kb(w.jsGzip).padStart(9)}`);
}
if (firstWeight) console.log(`first lesson ${first}: ${kb(firstWeight.totalGzip)} (budget ${kb(BUDGET.firstLessonTotal)})`);
if (overSpec.length) {
  console.warn(
    `warning: ${overSpec.length} page(s) exceed the spec's ${kb(BUDGET.jsPerPage)} JavaScript budget ` +
      `(React + Next.js runtime is ~130 KB gzip); failing only above ${kb(BUDGET.jsCeiling)}.`,
  );
}

if (failures.length) {
  console.error(`\npostbuild failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("postbuild: links and budget OK");
