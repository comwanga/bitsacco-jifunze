import fs from "node:fs";
import path from "node:path";

// Refs under /api/ are answered by the account API (api/), not by files in out/.
export function internalRefs(html: string): string[] {
  const refs: string[] = [];
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const ref = m[1];
    if (ref.startsWith("/") && !ref.startsWith("//") && !ref.startsWith("/api/")) refs.push(ref);
  }
  return refs;
}

export function resolvesInOut(outDir: string, ref: string): boolean {
  const clean = decodeURI(ref.split("#")[0].split("?")[0]);
  const p = path.join(outDir, clean);
  if (!p.startsWith(path.resolve(outDir))) return false;
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return true;
  if (fs.existsSync(path.join(p, "index.html"))) return true;
  return fs.existsSync(`${p.replace(/[\/]$/, "")}.html`);
}
