import { expect, test } from "@playwright/test";

test("three paths: three cards and three baobab branches", async ({ page }) => {
  await page.goto("/sw/");
  await expect(page.locator("[data-path-card]")).toHaveCount(3);
  await expect(page.locator(".mbuyu a")).toHaveCount(3);
  await expect(page.locator('.mbuyu a[href="/sw/lightning/"]')).toHaveCount(1);
});

test("a new learner sees Start on every path and no continue card", async ({ page }) => {
  await page.goto("/sw/");
  await expect(page.locator("[data-continue]")).toHaveCount(0);
  await expect(page.locator("[data-path-card] [data-resume]").first()).toHaveText(/Anza/);
});

test("after a finished lesson the continue card links to the next one", async ({ page }) => {
  await page.goto("/sw/");
  await page.evaluate(() =>
    localStorage.setItem(
      "jifunze:progress:v1",
      JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": { completedAt: "2026-11-01T10:00:00.000Z" } } }),
    ),
  );
  await page.reload();
  const card = page.locator("[data-continue]");
  await expect(card.getByRole("link")).toHaveAttribute("href", "/sw/savers/sats-and-volatility/");
  await expect(page.locator('[data-path-card="savers"] [data-resume]')).toHaveText(/Endelea/);
});

test("on a phone the first path is close to the top", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
  await page.goto("/sw/");
  const box = await page.locator("[data-path-card] h3").first().boundingBox();
  const vh = page.viewportSize()!.height;
  expect(box!.y).toBeLessThan(vh * 1.2);
});
