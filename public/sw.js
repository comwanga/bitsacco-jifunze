/* Bitsacco Jifunze service worker: offline reading for lessons you have opened. */
// The build ID changes this file on every deploy, so browsers install the new worker.
const VERSION = "__BUILD_ID__"; // replaced by scripts/postbuild.ts
// Cache names are NOT tied to the build: lessons a reader saved must survive site updates.
// Pages are network-first, so they refresh whenever the reader is online.
const PAGES = "pages-v1";
const STATIC = "static-v1";
const DATA = "data-v1";
const KEEP = [PAGES, STATIC, DATA];
const MAX_STATIC = 400; // old hashed chunks pile up across deploys; drop the oldest beyond this

function staleCaches(keys) {
  return keys.filter((k) => !KEEP.includes(k));
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}
const PRECACHE = [
  "/sw/",
  "/en/",
  "/sw/offline/",
  "/en/offline/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/logo.svg",
];

// The offline pages must hydrate without a connection, so cache the scripts and styles they use.
function staticAssetsOf(html) {
  // Modern browsers do not need noModule polyfills. Only inspect actual asset tags,
  // not paths embedded in serialized React data or inline scripts.
  const modern = html.replace(/<script\b[^>]*\bnomodule\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return [...modern.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["'](\/_next\/static\/[^"']+)["']/gi)].map((m) => m[1]);
}

async function precacheAssetsOf(pagesCache, paths) {
  const assets = new Set();
  for (const p of paths) {
    const res = await pagesCache.match(p);
    if (!res) continue;
    for (const asset of staticAssetsOf(await res.text())) assets.add(asset);
  }
  const statics = await caches.open(STATIC);
  await Promise.all([...assets].map((a) => statics.add(a).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES);
      await pages.addAll(PRECACHE);
      await precacheAssetsOf(pages, ["/sw/offline/", "/en/offline/"]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(staleCaches(keys).map((k) => caches.delete(k))))
      .then(() => trim(STATIC, MAX_STATIC))
      .then(() => self.clients.claim()),
  );
});

function langOf(pathname) {
  return pathname.startsWith("/en/") ? "en" : "sw";
}

// "/sw/savers/x/index.txt" or "/sw/savers/x/__next.a.b/c.txt" -> "/sw/savers/x/"
function pageOfData(pathname) {
  if (!/^\/(sw|en)\//.test(pathname)) return null;
  const i = pathname.search(/\/(index\.txt|__next\.)/);
  return i >= 0 ? pathname.slice(0, i + 1) : null;
}

// Signed-in account pages and the community must never be stored by the worker.
function privateNavigation(pathname) {
  return /^\/(sw|en)\/(account|community)(\/|$)/.test(pathname);
}

function cacheableStatic(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/") ||
    pathname === "/logo.svg" || pathname === "/manifest.webmanifest";
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(stripSearch(request), response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

function stripSearch(request) {
  const url = new URL(request.url);
  url.search = "";
  return url.toString();
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(stripSearch(request), response.clone());
    else if (response.status === 404 || response.status === 410) await cache.delete(stripSearch(request));
    return response;
  } catch {
    const pathname = new URL(request.url).pathname;
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(`/${langOf(pathname)}/offline/`)) ||
      Response.error()
    );
  }
}

// Network only; offline falls back to the shared offline page, never to a stored account page.
async function privatePage(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(PAGES);
    return (await cache.match(`/${langOf(new URL(request.url).pathname)}/offline/`)) || Response.error();
  }
}

// A page opened through in-app navigation only fetches its data file, so also keep its HTML
// for a full reload offline. Skipped for prefetches, to save data on metered connections.
async function warmPage(path) {
  if (privateNavigation(path)) return;
  const cache = await caches.open(PAGES);
  if (await cache.match(path)) return;
  try {
    const response = await fetch(path, { credentials: "same-origin" });
    if (response.ok) await cache.put(path, response);
  } catch {
    /* offline: nothing to warm */
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Explicit book transfers stay with the browser. Never cache a full PDF as a navigation page.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/books/")) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate" && privateNavigation(url.pathname)) {
    event.respondWith(privatePage(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  // Data and RSC fetches for private pages go straight to the browser network.
  if (privateNavigation(url.pathname)) return;
  const page = pageOfData(url.pathname);
  if (page) {
    event.respondWith(staleWhileRevalidate(DATA, request));
    if (page && !request.headers.get("Next-Router-Prefetch")) event.waitUntil(warmPage(page));
    return;
  }
  if (cacheableStatic(url.pathname)) event.respondWith(staleWhileRevalidate(STATIC, request));
  // Unknown same-origin paths use the browser's network without entering a cache.
});
