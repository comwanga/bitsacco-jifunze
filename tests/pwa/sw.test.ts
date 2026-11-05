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

// ---- Task 8: API bypass, private pages, 404/410 eviction ----
type Listener = (event: unknown) => void;
function harness(fetchImpl: (req: unknown, init?: unknown) => Promise<Response>, seed: Record<string, Record<string, Response>> = {}) {
  let listener: Listener = () => {};
  const stores: Record<string, Map<string, Response>> = {};
  const norm = (r: unknown) => (typeof r === "string" ? new URL(r, "http://x").toString() : (r as { url: string }).url);
  const cacheOf = (name: string) => {
    if (!stores[name]) {
      stores[name] = new Map(Object.entries(seed[name] ?? {}).map(([k, v]) => [new URL(k, "http://x").toString(), v]));
    }
    const s = stores[name];
    return {
      match: async (r: unknown) => s.get(norm(r))?.clone(),
      put: async (r: unknown, res: Response) => { s.set(norm(r), res); },
      delete: async (r: unknown) => s.delete(norm(r)),
      keys: async () => [],
    };
  };
  const cachesFake = {
    open: async (n: string) => cacheOf(n),
    match: async (r: unknown) => { for (const n of Object.keys(stores)) { const m = await cacheOf(n).match(r); if (m) return m; } return undefined; },
    keys: async () => Object.keys(stores),
    delete: async () => true,
  };
  const self = {
    location: { origin: "http://x" },
    addEventListener: (name: string, fn: Listener) => { if (name === "fetch") listener = fn; },
  };
  const api = new Function("self", "caches", "fetch", `${src}; return { privateNavigation };`)(self, cachesFake, fetchImpl) as { privateNavigation(p: string): boolean };
  const nav = (p: string, mode = "navigate", headers = new Headers()) => ({ method: "GET", url: `http://x${p}`, mode, headers });
  async function fire(request: unknown) {
    let responded: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    listener({ request, respondWith: (p: Promise<Response>) => { responded = p; }, waitUntil: (p: Promise<unknown>) => { waits.push(p); } });
    const response = responded ? await responded : undefined;
    await Promise.all(waits);
    return { intercepted: !!responded, response };
  }
  const cached = (name: string) => [...(stores[name]?.keys() ?? [])];
  return { api, nav, fire, cached, cachesFake, stores };
}

test("a navigation to /api/auth/github/start is not intercepted", async () => {
  const h = harness(async () => { throw new Error("must not fetch"); });
  for (const mode of ["navigate", "cors", "same-origin"]) {
    for (const method of ["GET", "POST"]) {
      const r = await h.fire({ ...h.nav("/api/auth/github/start", mode), method });
      expect(r.intercepted, `${method} ${mode}`).toBe(false);
    }
  }
  expect(h.cached("pages-v1")).toEqual([]);
});

test("book downloads and PDF navigations never enter the offline lesson cache", async () => {
  const h = harness(async () => { throw Error("book must use browser network directly"); });
  for (const mode of ["navigate", "cors", "same-origin"]) {
    expect((await h.fire(h.nav("/books/mastering-bitcoin-en-3rd-edition.pdf", mode))).intercepted).toBe(false);
  }
  expect(Object.keys(h.stores)).toEqual([]);
});

test("a navigation to /sw/account/ is answered from the network and never put in any cache", async () => {
  const h = harness(async () => new Response("secret", { status: 200 }));
  const r = await h.fire(h.nav("/sw/account/"));
  expect(r.intercepted).toBe(true);
  expect(await r.response!.text()).toBe("secret");
  for (const n of Object.keys(h.stores)) expect(h.cached(n), n).toEqual([]);
});

test("/en/community/x/ behaves the same", async () => {
  const h = harness(async () => new Response("c", { status: 200 }));
  const r = await h.fire(h.nav("/en/community/x/"));
  expect(r.intercepted).toBe(true);
  expect(await r.response!.text()).toBe("c");
  for (const n of Object.keys(h.stores)) expect(h.cached(n), n).toEqual([]);
});

test("a private navigation that fails on the network answers the cached offline page", async () => {
  const h = harness(async () => { throw new TypeError("offline"); }, { "pages-v1": { "/en/offline/": new Response("offline-en") } });
  const r = await h.fire(h.nav("/en/account/"));
  expect(await r.response!.text()).toBe("offline-en");
});

test("private data files and warming never cache account pages", async () => {
  const h = harness(async () => new Response("d", { status: 200 }));
  for (const p of ["/sw/account/index.txt", "/en/community/x/__next.a/b.txt"]) {
    await h.fire(h.nav(p, "cors"));
  }
  for (const n of Object.keys(h.stores)) expect(h.cached(n), n).toEqual([]);
});

for (const status of [404, 410]) {
  test(`a cached /en/glossary/ is deleted when the network returns ${status}`, async () => {
    const h = harness(async () => new Response("gone", { status }), { "pages-v1": { "/en/glossary/": new Response("old") } });
    const r = await h.fire(h.nav("/en/glossary/?x=1"));
    expect(r.response!.status).toBe(status);
    expect(h.cached("pages-v1")).toEqual([]);
  });
}

test("a 200 navigation is still cached as before", async () => {
  const h = harness(async () => new Response("fresh", { status: 200 }));
  await h.fire(h.nav("/en/glossary/"));
  expect(h.cached("pages-v1")).toEqual(["http://x/en/glossary/"]);
});

test("privateNavigation matches account and community paths only", () => {
  const { api } = harness(async () => new Response(""));
  for (const p of ["/sw/account", "/sw/account/", "/en/community/a/"]) expect(api.privateNavigation(p), p).toBe(true);
  for (const p of ["/sw/accounts/", "/sw/learn/"]) expect(api.privateNavigation(p), p).toBe(false);
});
