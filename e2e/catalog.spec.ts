import { expect, test } from "@playwright/test";

test("catalogue searches, combines filters and clears an empty result", async ({ page }) => {
  await page.goto("/en/learn/");
  const rows = page.locator("[data-catalog-entry]");
  await expect(rows).toHaveCount(33);
  await page.getByRole("searchbox").fill("htlc");
  await expect(page.locator('[data-catalog-entry="lightning/routing-htlcs"]')).toBeVisible();
  await page.getByRole("combobox", { name: "Lesson type", exact: true }).selectOption("lab");
  await expect(page.locator('[data-catalog-entry="lightning/routing-htlcs"]')).toBeVisible();
  await page.getByRole("combobox", { name: "Path", exact: true }).selectOption("savers");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("No lesson matches", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(33);
  await page.getByRole("searchbox").fill("zzzz-no-lesson");
  await expect(page.getByText("No lesson matches", { exact: true })).toBeVisible();
});

test("catalogue renders every lesson without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/sw/learn/");
  await expect(page.locator("[data-catalog-entry]")).toHaveCount(33);
  await expect(page.locator('a[href="/sw/lightning/routing-htlcs/"]')).toBeVisible();
  await context.close();
});
