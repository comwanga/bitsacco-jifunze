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

test("the main actions are on the first screen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  const vh = page.viewportSize()!.height;
  const start = (await page.getByRole("link", { name: "Start learning" }).boundingBox())!;
  expect(start.y + start.height).toBeLessThanOrEqual(vh);
  await expect(page.getByRole("link", { name: "Browse all lessons" })).toHaveAttribute("href", "/en/learn/");
});

test("how it works is a four-step journey", async ({ page }) => {
  await page.goto("/sw/");
  const steps = page.locator("[data-loop] > li");
  await expect(steps).toHaveCount(4);
  await expect(steps.locator("h3")).toHaveText(["Jifunze", "Jaribu", "Tumia", "Shiriki"]);
});

test("library and glossary are cards with a clear action", async ({ page }) => {
  await page.goto("/en/");
  const library = page.locator('[data-resource="library"]');
  const glossary = page.locator('[data-resource="glossary"]');
  await expect(library).toHaveAttribute("href", "/en/library/");
  await expect(glossary).toHaveAttribute("href", "/en/glossary/");
  await expect(library.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(glossary).toContainText("50 terms");
  await expect(library).toContainText("Open the library");
  await glossary.focus();
  await expect(glossary).toBeFocused();
});

test("the footer groups real destinations and keeps the disclaimer and licence", async ({ page }) => {
  await page.goto("/sw/");
  const footer = page.locator("footer");
  await expect(footer.locator("[data-brand]")).toBeVisible();
  for (const href of ["/sw/learn/", "/sw/lightning/", "/sw/simulations/", "/sw/progress/", "/sw/library/", "/sw/glossary/"]) {
    await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", /github\.com\/comwanga\/bitsacco-jifunze$/);
  await expect(footer.getByRole("link", { name: "Shukrani" })).toHaveAttribute("href", /ATTRIBUTIONS\.md$/);
  await expect(footer).toContainText("Si ushauri wa kifedha");
  await expect(footer).toContainText("CC BY-SA 4.0");
  await expect(footer.getByRole("heading", { level: 2 })).toHaveText(["Kujifunza", "Rasilimali", "Mradi"]);
});
