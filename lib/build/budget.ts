import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { internalRefs } from "./links.ts";

/**
 * jsPerPage and firstLessonTotal are the v1 spec's budgets. React 19 + the Next.js 16 App Router
 * runtime alone is ~130 KB gzip, so the JS gate fails only above jsCeiling (a regression guard)
 * and warns above the spec value. Lab pages (laptop-only, with the exercise editor) get jsCeilingLab.
 * See the README for the open decision.
 */
export const BUDGET = { firstLessonTotal: 200 * 1024, jsPerPage: 100 * 1024, jsCeiling: 150 * 1024, jsCeilingLab: 165 * 1024 };

const gzipSize = (file: string) => zlib.gzipSync(fs.readFileSync(file)).length;

export function pageWeight(outDir: string, htmlFile: string): { totalGzip: number; jsGzip: number } {
  // Modern browsers never download noModule polyfills.
  const html = fs.readFileSync(htmlFile, "utf8").replace(/<script\b[^>]*\bnomodule\b[^>]*>\s*<\/script>/gi, "");
  let totalGzip = gzipSize(htmlFile);
  let jsGzip = 0;
  const assets = new Set(
    internalRefs(html)
      .map((r) => decodeURI(r.split("?")[0].split("#")[0]))
      .filter((r) => r.startsWith("/_next/static/") && /\.(js|css)$/.test(r)),
  );
  for (const a of assets) {
    const file = path.join(outDir, a);
    if (!fs.existsSync(file)) continue;
    const size = gzipSize(file);
    totalGzip += size;
    if (a.endsWith(".js")) jsGzip += size;
  }
  return { totalGzip, jsGzip };
}
