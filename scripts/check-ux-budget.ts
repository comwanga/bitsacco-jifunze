import fs from "node:fs";
import path from "node:path";
import { pageWeight } from "../lib/build/budget.ts";
import { UX_LIMITS, uxPageKind, type UxPageKind } from "../lib/build/ux-budget.ts";

const out = path.resolve("out");
if (!fs.existsSync(out)) throw new Error("Run npm run build before checking UX budgets.");
const maxima = new Map<UxPageKind, number>();
const failures: string[] = [];
for (const file of fs.readdirSync(out, { recursive: true })) {
  if (typeof file !== "string" || !file.endsWith(".html")) continue;
  const absolute = path.join(out, file);
  const html = fs.readFileSync(absolute, "utf8");
  const kind = uxPageKind(file, html.includes("data-jifunze-lab"));
  if (!kind) continue;
  const kb = pageWeight(out, absolute).jsGzip / 1024;
  maxima.set(kind, Math.max(kb, maxima.get(kind) ?? 0));
  if (kb > UX_LIMITS[kind]) failures.push(`${file}: ${kb.toFixed(2)} KB > ${UX_LIMITS[kind]} KB`);
  if (kind === "simulation" && /connect-src[^;]*7777/.test(html)) failures.push(`${file}: simulation must not have live-lab connection permissions`);
}
for (const [kind, kb] of maxima) console.log(`UX ${kind}: ${kb.toFixed(2)} / ${UX_LIMITS[kind]} KB gzip JS`);
for (const kind of ["home", "catalogue", "roadmap", "lesson", "lab", "tree", "simulation"] as const) {
  if (!maxima.has(kind)) failures.push(`Missing built pages for ${kind}`);
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("UX initial page budgets and simulation connection permissions passed; activated chunks are checked by Playwright.");
