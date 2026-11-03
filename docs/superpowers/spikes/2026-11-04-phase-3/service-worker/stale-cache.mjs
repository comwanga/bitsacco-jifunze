// Spike: does the current service worker keep a page after the server stops serving it?
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const [repo, site] = process.argv.slice(2);
const { chromium } = createRequire(path.join(repo, "package.json"))("@playwright/test");
const srv = spawn("node", [path.join(repo, "scripts/serve-out.mjs"), site, "4327"]);
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const ctx = await b.newContext();
const pg = await ctx.newPage();
const page = "http://localhost:4327/en/glossary/";
await pg.goto(page);
await pg.waitForFunction(() => navigator.serviceWorker?.controller != null);
await pg.reload(); // the worker now sees the navigation and caches it
const cachedBefore = await pg.evaluate(async () => Boolean(await (await caches.open("pages-v1")).match("/en/glossary/")));
fs.rmSync(path.join(site, "en/glossary/index.html")); // "unpublish": the server no longer has the page
const online = await pg.goto(page);
const onlineStatus = online.status();
const cachedAfter = await pg.evaluate(async () => Boolean(await (await caches.open("pages-v1")).match("/en/glossary/")));
await ctx.setOffline(true);
await pg.reload().catch(() => {});
const offlineH1 = await pg.locator("h1").first().textContent().catch(() => null);
console.log(JSON.stringify({ cachedBefore, onlineStatusAfterRemoval: onlineStatus, stillCachedAfterOnline404: cachedAfter, offlineShows: offlineH1 }));
await b.close(); srv.kill();
