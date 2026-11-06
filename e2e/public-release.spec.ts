import { expect, test } from "@playwright/test";
import { ACCOUNTS_AVAILABLE } from "../lib/site";
import fs from "node:fs";
import { t } from "../lib/i18n";

for (const lang of ["en", "sw"] as const) test(`${lang}: local progress import and export work without accounts`, async ({ page }, info) => {
  const progress = { app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": { completedAt: "2026-11-01T10:00:00.000Z" } } };
  await page.goto(`/${lang}/progress/`);
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(progress)) });
  await expect(page.getByRole("status")).toHaveText(t(lang, "importOk"));
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: t(lang, "exportBtn"), exact: true }).click();
  const file = info.outputPath(`progress-${lang}.json`);
  await (await download).saveAs(file);
  expect(JSON.parse(fs.readFileSync(file, "utf8")).lessons).toEqual(progress.lessons);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons)).toEqual(progress.lessons);
});

test.describe("anonymous public release", () => {
  test.skip(ACCOUNTS_AVAILABLE, "requires the public-origin export");
  for (const lang of ["en", "sw"] as const) {
    test(`${lang}: account URLs explain availability without calling an API`, async ({ page }) => {
      const api: string[] = [];
      page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url()); });
      for (const route of ["", "signin/", "welcome/", "recovery/", "signout/"]) {
        await page.goto(`/${lang}/account/${route}`);
        await expect(page.locator("[data-account-unavailable]")).toBeVisible();
        await expect(page.locator('a[href*="/api/"], main input, main button')).toHaveCount(0);
        await expect(page.locator('header a[href*="/account/"]:not([hreflang])')).toHaveCount(0);
      }
      expect(api).toEqual([]);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
      const cached = await page.evaluate(async () => {
        const urls: string[] = [];
        for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
        return urls.filter(p => p.startsWith("/api/") || /\/(account|community)(\/|$)/.test(p));
      });
      expect(cached).toEqual([]);
    });
  }
});

test("Lightning lessons contact the local lab only after a deliberate connection, even with a saved token", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jifunze:lab", JSON.stringify({ url: "http://127.0.0.1:7777", token: "saved-pairing-token" })));
  const requests: string[] = [];
  await page.route("http://127.0.0.1:7777/**", route => {
    requests.push(route.request().url());
    return route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthorized"}' });
  });
  await page.goto("/en/lightning/routing-htlcs/");
  const connect = page.getByRole("button", { name: "Check my lab", exact: true });
  await expect(connect).toBeVisible();
  // Cover a complete polling interval, visibility changes and multiple lab consumers.
  await page.waitForTimeout(16_000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(requests).toEqual([]);
  await connect.click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests.every(url => url === "http://127.0.0.1:7777/status")).toBe(true);
});
