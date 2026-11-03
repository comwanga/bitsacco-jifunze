import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { BrowserContext } from "@playwright/test";

export function trackScripts(context: BrowserContext): Set<string> {
  const scripts = new Set<string>();
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js")) scripts.add(url.pathname);
  });
  return scripts;
}
export function scriptGzip(paths: Iterable<string>): number {
  return [...new Set(paths)].reduce((sum, p) => sum + zlib.gzipSync(fs.readFileSync(path.join(process.cwd(), "out", decodeURIComponent(p)))).length, 0);
}
