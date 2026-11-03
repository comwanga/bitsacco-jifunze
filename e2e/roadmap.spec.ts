import { expect, test } from "@playwright/test";

test("roadmap badges distinguish reading lessons from labs", async ({ page }) => {
  await page.goto("/en/lightning/");
  const routing = page.locator('main a[href="/en/lightning/routing-htlcs/"]');
  await expect(routing.getByText("Lab", { exact: true })).toBeVisible();
  await expect(routing.getByText("Quiz", { exact: true })).toBeVisible();
  const introduction = page.locator('main a[href="/en/lightning/introduction/"]');
  await expect(introduction.getByText("Reading", { exact: true })).toBeVisible();
  await expect(introduction.getByText("Lab", { exact: true })).toHaveCount(0);
});

test("roadmap resumes the next lesson and counts completion by section", async ({ page }) => {
  await page.goto("/sw/savers/");
  await expect(page.locator("[data-resume]")).toHaveText("Anza");
  await page.evaluate(() => localStorage.setItem("jifunze:progress:v1", JSON.stringify({
    app: "bitsacco-jifunze", version: 1,
    lessons: { "savers/money-and-bitcoin": { completedAt: "2026-11-01T10:00:00.000Z" } },
  })));
  await page.reload();
  await expect(page.locator("[data-resume]")).toHaveText("Endelea");
  await expect(page.locator("[data-resume]")).toHaveAttribute("href", "/sw/savers/sats-and-volatility/");
  const heading = page.getByRole("heading", { name: "Misingi", exact: true }); // progress is not part of the heading
  await expect(heading).toBeVisible();
  await expect(page.locator('[data-section-progress="misingi"]')).toHaveText("1 / 2 umemaliza");
});

test("tree section headings are named by their title alone", async ({ page }) => {
  await page.goto("/sw/tree/savers/");
  await expect(page.getByRole("heading", { level: 2, name: "Misingi", exact: true })).toBeVisible();
  await expect(page.locator('[data-section-progress="misingi"]')).toHaveText("0 / 2 umemaliza");
});
