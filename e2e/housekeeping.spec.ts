import { expect, test } from "@playwright/test";

test("static metadata includes lessons and language alternatives", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "static files are shared by both projects");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/sw/savers/wallets-keys/");
  expect(xml).toContain("/en/lightning/conclusion/");
  expect(xml.match(/<url>/g)).toHaveLength(84);
  expect(xml).toContain('hreflang="sw"');
  expect(xml).toContain('hreflang="en"');
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Sitemap:");
});

test("a lesson opened through in-app navigation reloads offline", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "one browser is enough for the service worker");
  await page.goto("/en/savers/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.locator('main a[href="/en/savers/wallets-keys/"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wallets");
  await page.waitForFunction(async () => Boolean(await (await caches.open("pages-v1")).match("/en/savers/wallets-keys/")));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wallets");
  await context.setOffline(false);
});
