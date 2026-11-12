import { expect, test } from "@playwright/test";
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

for (const lang of ["en", "sw"] as const) test(`${lang}: importing tied quiz scores keeps the longer attempt in either order`, async ({ page }, info) => {
  const at = "2026-11-01T08:00:00.000Z";
  const key = "savers/money-and-bitcoin";
  const doc = (correct: number, total: number) => ({ app: "bitsacco-jifunze", version: 1, lessons: { [key]: { quiz: { correct, total, at } } } });
  const api: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url()); });
  for (const [current, incoming] of [[doc(1, 2), doc(2, 4)], [doc(2, 4), doc(1, 2)]]) {
    await page.goto(`/${lang}/progress/`);
    await page.evaluate(progress => localStorage.setItem("jifunze:progress:v1", JSON.stringify(progress)), current);
    await page.reload();
    await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(incoming)) });
    await expect(page.getByRole("status")).toHaveText(t(lang, "importOk"));
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: t(lang, "exportBtn"), exact: true }).click();
    const file = info.outputPath(`quiz-merge-${lang}-${current.lessons[key].quiz.total}.json`);
    await (await download).saveAs(file);
    expect(JSON.parse(fs.readFileSync(file, "utf8")).lessons[key].quiz).toEqual({ correct: 2, total: 4, at });
    await page.reload();
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons[key].quiz, key)).toEqual({ correct: 2, total: 4, at });
  }
  expect(api).toEqual([]);
});

test.describe("account-free learning", () => {
  for (const lang of ["en", "sw"] as const) {
    test(`${lang}: retired account URLs answer not found and offer no sign-in`, async ({ page }) => {
      const api: string[] = [];
      page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url()); });
      for (const route of ["", "signin/", "welcome/", "recovery/", "signout/"]) {
        const response = await page.goto(`/${lang}/account/${route}`);
        expect(response!.status()).toBe(404);
        await expect(page.locator('a[href*="/api/"], a[href*="/account/"], form, input, [data-save-progress]')).toHaveCount(0);
      }
      // No page links to an account, and the header offers feedback where the account link used to be.
      await page.goto(`/${lang}/`);
      await expect(page.locator('a[href*="/account/"]')).toHaveCount(0);
      await expect(page.locator("header [data-header-feedback]").first()).toHaveAttribute("href", /^mailto:/);
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
