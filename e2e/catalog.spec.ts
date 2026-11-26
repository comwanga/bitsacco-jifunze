import { expect, test } from "@playwright/test";

test("catalogue opens on community finance, searches, combines filters and clears back to the default", async ({ page }) => {
  await page.goto("/en/learn/");
  const rows = page.locator("[data-catalog-entry]");
  const path = page.getByRole("combobox", { name: "Path", exact: true });
  await expect(path).toHaveValue("savers");
  await expect(rows).toHaveCount(24);
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  await path.selectOption("");
  await expect(rows).toHaveCount(49);
  await page.getByRole("searchbox").fill("htlc");
  await expect(page.locator('[data-catalog-entry="lightning/routing-htlcs"]')).toBeVisible();
  await page.getByRole("combobox", { name: "Lesson type", exact: true }).selectOption("lab");
  await expect(page.locator('[data-catalog-entry="lightning/routing-htlcs"]')).toBeVisible();
  await path.selectOption("savers");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("No lesson matches", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(path).toHaveValue("savers");
  await expect(rows).toHaveCount(24);
  await page.getByRole("searchbox").fill("zzzz-no-lesson");
  await expect(page.getByText("No lesson matches", { exact: true })).toBeVisible();
});

test("without JavaScript the catalogue lists community finance and links to the other paths", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/sw/learn/");
  await expect(page.locator("[data-catalog-entry]")).toHaveCount(24);
  await expect(page.locator('a[href="/sw/savers/money-and-bitcoin/"]')).toBeVisible();
  const others = page.locator("[data-other-paths]");
  await expect(others.locator('a[href="/sw/builders/"]')).toBeVisible();
  await expect(others.locator('a[href="/sw/lightning/"]')).toBeVisible();
  await others.locator('a[href="/sw/lightning/"]').click();
  await expect(page.locator('a[href="/sw/lightning/routing-htlcs/"]').first()).toBeAttached();
  await context.close();
});
