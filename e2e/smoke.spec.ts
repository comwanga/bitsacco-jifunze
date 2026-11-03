import { expect, test } from "@playwright/test";

test("/ sends Kiswahili readers to the Kiswahili home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sw\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Karibu Jifunze");
});

test("the language switch keeps you on the same lesson", async ({ page }) => {
  await page.goto("/sw/savers/wallets-keys/");
  await page.locator('header a[hreflang="en"]').click();
  await expect(page).toHaveURL(/\/en\/savers\/wallets-keys\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wallets");
});

test("pages never scroll sideways on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/sw/", "/sw/learn/", "/en/learn/", "/sw/savers/", "/sw/savers/wallets-keys/", "/en/lightning/routing-htlcs/", "/sw/glossary/", "/sw/tree/lightning/", "/en/simulations/", "/sw/simulations/utxo/", "/sw/simulations/channel-balances/"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

test("with reduced motion the intro never plays", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sw/");
  await expect(page.locator("html")).not.toHaveClass(/intro-play/);
  await expect(page.getByRole("group", { name: /Mbuyu/ })).toBeVisible();
});

test("a lesson opened once stays readable offline", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "one browser is enough for the service worker");
  await page.goto("/sw/savers/wallets-keys/");
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null && navigator.serviceWorker?.controller !== undefined);
  await page.reload(); // now the service worker sees the navigation and caches it
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pochi");
  await context.setOffline(false);
});
