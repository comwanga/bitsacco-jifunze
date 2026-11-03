import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const src = fs.readFileSync(path.join(import.meta.dirname, "../../public/sw.js"), "utf8");
const fakeSelf = { addEventListener: () => {}, location: { origin: "http://x" } };
const sw = new Function("self", "caches", "fetch", `${src}; return { pageOfData, langOf, staleCaches, cacheableStatic, staticAssetsOf };`)(fakeSelf, {}, () => {}) as {
  pageOfData(p: string): string | null;
  langOf(p: string): string;
  staleCaches(keys: string[]): string[];
  cacheableStatic(p: string): boolean;
  staticAssetsOf(html: string): string[];
};

test("offline precaching uses real asset tags and skips legacy-only scripts and serialized paths", () => {
  const html = '<script src="/_next/static/modern.js"></script><script src="/_next/static/polyfill.js" noModule=""></script>' +
    '<link rel="stylesheet" href="/_next/static/styles.css"><script>const path="/_next/static/not-a-tag.js";</script>';
  expect(sw.staticAssetsOf(html)).toEqual(["/_next/static/modern.js", "/_next/static/styles.css"]);
});

test("only known static paths may enter the fallback cache", () => {
  for (const p of ["/_next/static/x.js", "/icons/icon-192.png", "/logo.svg", "/manifest.webmanifest"]) {
    expect(sw.cacheableStatic(p), p).toBe(true);
  }
  for (const p of ["/api/me", "/unknown.json", "/logo.svg/private", "/icons-private/x.png"]) {
    expect(sw.cacheableStatic(p), p).toBe(false);
  }
});

test("unknown same-origin fetches bypass the worker's caches", () => {
  let listener: (event: unknown) => void = () => {};
  const self = {
    location: { origin: "http://x" },
    addEventListener: (name: string, fn: (event: unknown) => void) => { if (name === "fetch") listener = fn; },
  };
  const fail = () => { throw new Error("unknown paths must use the browser network directly"); };
  new Function("self", "caches", "fetch", src)(self, { open: fail, match: fail }, fail);
  for (const headers of [new Headers(), new Headers({ RSC: "1" })]) {
    listener({ request: new Request("http://x/api/me", { headers }), respondWith: fail, waitUntil: fail });
  }
});

test("a new deploy keeps the pages readers saved offline; only unknown caches are removed", () => {
  const keep = ["pages-v1", "static-v1", "data-v1"];
  expect(sw.staleCaches([...keep, "pages-OLDBUILD", "static-OLDBUILD", "other"])).toEqual(["pages-OLDBUILD", "static-OLDBUILD", "other"]);
  expect(src).not.toMatch(/const PAGES = `pages-\$\{VERSION\}`/);
});

test("maps Next data files back to the page they belong to", () => {
  expect(sw.pageOfData("/sw/savers/wallets-keys/index.txt")).toBe("/sw/savers/wallets-keys/");
  expect(sw.pageOfData("/en/builders/x/__next.$d$lang/$d$roadmap/__PAGE__.txt")).toBe("/en/builders/x/");
  expect(sw.pageOfData("/_next/static/chunks/a.js")).toBeNull();
});

test("offline fallback language follows the URL, defaulting to Kiswahili", () => {
  expect(sw.langOf("/en/savers/x/")).toBe("en");
  expect(sw.langOf("/sw/savers/x/")).toBe("sw");
  expect(sw.langOf("/")).toBe("sw");
});
