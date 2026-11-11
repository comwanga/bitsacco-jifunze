import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const lang of ["sw", "en"]) {
  test(`tree curriculum and accessible links in ${lang}`, async ({ page }, info) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: info.project.name === "mobile" ? "dark" : "light" });
    if (info.project.name === "mobile") await page.setViewportSize({ width: 360, height: 800 });
    for (const [id, count] of [["savers", 24], ["builders", 8], ["lightning", 17]] as const) {
      await page.goto(`/${lang}/tree/${id}/`);
      await expect(page.locator("[data-tree-lesson]")).toHaveCount(count);
      await expect(page.getByRole("link", { name: lang === "en" ? "Tree" : "Mti", exact: true })).toHaveAttribute("aria-current", "page");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.filter((v) => ["serious", "critical"].includes(v.impact!))).toEqual([]);
      if (id === "builders") await expect(page.locator('[data-tree-lesson="ship-a-tool"] [data-prerequisites] a')).toHaveCount(2);
    }
  });
  test(`trees work without JavaScript in ${lang}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
    const page = await context.newPage();
    for (const [id, count] of [["savers", 24], ["builders", 8], ["lightning", 17]] as const) {
      await page.goto(`/${lang}/tree/${id}/`);
      await expect(page.locator("[data-tree-lesson] h3 a")).toHaveCount(count);
      await page.locator("[data-tree-lesson] h3 a").first().click();
      await expect(page).toHaveURL(new RegExp(`/${lang}/${id}/[^/]+/$`));
    }
    await context.close();
  });
}

test("tree resumes progress and tolerates unavailable storage", async ({ page }) => {
  await page.goto("/en/savers/");
  await page.getByRole("link", { name: "Tree", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/tree\/savers\/$/);
  await page.evaluate(() => localStorage.setItem("jifunze:progress:v1", JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": { completedAt: "2026-11-03T10:00:00Z" } } })));
  await page.reload();
  await expect(page.locator("[data-resume]")).toHaveAttribute("href", "/en/savers/sats-and-volatility/");
  await expect(page.getByRole("heading", { name: "The basics", exact: true })).toBeVisible();
  await expect(page.locator('[data-section-progress="misingi"]')).toHaveText("1 / 2 done");
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } }));
  await page.reload();
  await expect(page.locator("[data-tree-lesson]")).toHaveCount(24);
  await expect(page.locator("[data-resume]")).toHaveText("Start");
});
