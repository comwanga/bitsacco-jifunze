import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import meta from "../public/books/mastering-bitcoin-en-3rd-edition.source.json";

const route = "/en/library/mastering-bitcoin-en/";
const pdf = `/books/${meta.filename}`;
test("ordinary learning pages do not request the book", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/books/")) requests.push(r.url()); });
  for (const path of ["/en/", "/sw/lightning/routing-htlcs/"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  expect(requests).toEqual([]);
});
test("book loads on request, reuses the verified download, and stays out of offline caches", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname === pdf) requests.push(r.url()); });
  await page.goto(route);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Third Edition");
  await expect(page.getByText("Andreas M. Antonopoulos & David A. Harding", { exact: true })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://bitsaccojifunze.xyz${route}`);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(requests).toEqual([]);
  const response = page.waitForResponse(r => new URL(r.url()).pathname === pdf);
  const read = page.getByRole("button", { name: "Read PDF", exact: true });
  await expect(read).toBeEnabled();
  await read.click();
  const res = await response;
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^application\/pdf/);
  await expect(page.locator("iframe")).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
  expect(requests).toHaveLength(1);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download complete PDF" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(meta.filename);
  const data = await fs.readFile((await download.path())!);
  expect(data.length).toBe(meta.bytes);
  expect(createHash("sha256").update(data).digest("hex")).toBe(meta.sha256);
  expect(requests).toHaveLength(1);
  expect(new URL(page.url()).pathname).toBe(route);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page }).exclude("iframe").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]); // Native PDF viewer accessibility belongs to the browser.
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) for (const req of await (await caches.open(key)).keys()) urls.push(req.url);
    return urls;
  });
  expect(cached.filter(url => new URL(url).pathname.startsWith("/books/"))).toEqual([]);
});

for (const failure of ["http", "wrong-type", "truncated", "wrong-hash", "interrupted"]) test(`reader reports ${failure} loads and permits retry`, async ({ page }) => {
  await page.route(`**${pdf}`, route => failure === "interrupted" ? route.abort("connectionreset") : route.fulfill({
    status: failure === "http" ? 503 : 200,
    contentType: failure === "wrong-type" ? "text/html" : "application/pdf",
    body: failure === "wrong-hash" ? Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(meta.bytes - 5)]) : "%PDF-truncated",
  }));
  await page.goto(route);
  await page.getByRole("button", { name: "Read PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be loaded or verified");
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download complete PDF" })).toHaveAttribute("href", pdf);
  await page.unroute(`**${pdf}`);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
});

test("loading can be cancelled and Kiswahili navigation uses the same reader", async ({ page }) => {
  await page.route(`**${pdf}`, async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.abort().catch(() => {});
  });
  await page.goto("/sw/library/mastering-bitcoin-en/");
  const read = page.getByRole("button", { name: "Soma PDF", exact: true });
  await expect(read).toBeEnabled();
  await read.focus();
  await expect(read).toBeFocused();
  await read.press("Enter");
  await expect(page.getByRole("status")).toContainText("Inapakia");
  await page.getByRole("button", { name: "Ghairi" }).click();
  await expect(read).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
