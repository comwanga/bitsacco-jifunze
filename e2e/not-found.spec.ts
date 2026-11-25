import { expect, test } from "@playwright/test";

test("a missing page offers every main destination in both languages", async ({ page }) => {
  const response = await page.goto("/en/no-such-page/");
  expect(response!.status()).toBe(404);
  for (const lang of ["sw", "en"]) {
    const nav = page.locator(`[data-not-found-links][lang="${lang}"]`);
    const hrefs = await nav.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(["savers/", "builders/", "lightning/", "learn/", "glossary/", "library/"].map((p) => `/${lang}/${p}`));
  }
  await expect(page.locator("form, input")).toHaveCount(0);
});
