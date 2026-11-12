import { expect, test } from "@playwright/test";
import { indexablePaths } from "../lib/content/routes";
import { SITE_INDEXABLE, SITE_URL } from "../lib/site";
import { LANGS } from "../lib/i18n";

test("static metadata includes lessons and language alternatives", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "static files are shared by both projects");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/sw/savers/wallets-keys/");
  expect(xml).toContain("/en/lightning/conclusion/");
  expect(xml.match(/<url>/g)).toHaveLength(indexablePaths().length * LANGS.length);
  expect(xml).not.toContain("/offline/");
  expect(xml).toContain("/en/tree/lightning/");
  expect(xml).toContain("/sw/simulations/channel-balances/");
  expect(xml).toContain('hreflang="sw"');
  expect(xml).toContain('hreflang="en"');
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain(SITE_INDEXABLE ? `Sitemap: ${SITE_URL}/sitemap.xml` : "Disallow: /");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>|href="([^"]+)"/g)].map(m => m[1] || m[2]);
  expect(urls.every(url => new URL(url).origin === SITE_URL)).toBe(true);
});

test("a lesson opened through in-app navigation reloads offline", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "one browser is enough for the service worker");
  await page.goto("/en/savers/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.locator('[data-tree-lesson="wallets-keys"] h3 a').click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wallets");
  await page.waitForFunction(async () => Boolean(await (await caches.open("pages-v1")).match("/en/savers/wallets-keys/")));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wallets");
  await context.setOffline(false);
});
