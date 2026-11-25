import { expect, test } from "@playwright/test";

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
  await expect(card.getByRole("link", { name: /Endelea/ })).toHaveAttribute("href", "/sw/savers/sats-and-volatility/");
  await expect(card).toContainText("Imehifadhiwa kwenye kivinjari hiki pekee.");
  await expect(card.getByRole("link", { name: "Dhibiti maendeleo" })).toHaveAttribute("href", "/sw/progress/");
  await expect(page.locator('[data-path-card="savers"] [data-resume]')).toHaveText(/Endelea/);
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
  await expect(glossary).toContainText("57 terms");
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

test("the hero shows computed content counts", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("[data-stats]")).toHaveText(/49 lessons.*2 languages.*about 34 hours of reading.*57 glossary terms/s);
  await page.goto("/sw/");
  await expect(page.locator("[data-stats]")).toContainText("masomo 49");
});

test("community finance leads, builders follow as numbered tools paths", async ({ page }) => {
  await page.goto("/en/");
  const cards = page.locator("[data-path-card]");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute("data-path-card", "savers");
  await expect(cards.nth(0)).toHaveAttribute("data-variant", "lead");
  await expect(cards.locator("[data-path-number]")).toHaveText(["01", "02", "03"]);
  await expect(cards.nth(0)).toContainText("After this path you can check a chama or SACCO before you join");
  await expect(page.getByRole("heading", { name: "Build the tools communities need" })).toBeVisible();
});

for (const lang of ["en", "sw"] as const)
  test(`${lang}: four starting points link to existing lessons`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    const links = page.locator("[data-start] a");
    await expect(links).toHaveCount(4);
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual([`/${lang}/savers/saving-together/`, `/${lang}/savers/#specializations`, `/${lang}/savers/money-and-bitcoin/`, `/${lang}/savers/group-payments/`]);
    await links.nth(1).click();
    await expect(page.locator("#specializations")).toBeVisible();
  });

test("no horizontal scroll at 320px in Kiswahili", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/sw/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

for (const lang of ["en", "sw"] as const)
  test(`${lang}: glossary term links land on real rows`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    const links = page.locator("[data-glossary-terms] a");
    await expect(links).toHaveCount(5);
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(["chama", "rosca", "quorum", "self-custody"].map((id) => `/${lang}/glossary/#${id}`).concat(`/${lang}/glossary/`));
    await links.nth(2).click();
    await expect(page.locator("#quorum")).toBeInViewport();
  });

test("the hero shows the savings circle steps in order", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check before you save");
  await expect(page.locator("[data-circle-steps] li")).toHaveText(["Learn how it works", "Check the group", "Save together", "Teach your chama"]);
  await page.goto("/sw/");
  await expect(page.locator("[data-circle-steps] li").first()).toHaveText("Jifunze jinsi inavyofanya kazi");
});

test("the circle runs once and rests on step 4", async ({ page }) => {
  await page.goto("/en/");
  await page.waitForTimeout(5500);
  const state = await page.locator("[data-circle]").evaluate((el) =>
    el.getAnimations({ subtree: true }).map((a) => ({ state: a.playState, iterations: a.effect?.getTiming().iterations })));
  expect(state.length).toBeGreaterThan(0);
  expect(state.every((s) => s.state === "finished" && s.iterations !== Infinity)).toBe(true);
  await expect(page.locator('[data-circle-steps] li[data-step="4"]')).toHaveCSS("background-color", "rgb(201, 68, 0)");
});

test("reduced motion shows every step without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  expect(await page.locator("[data-circle]").evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator("[data-circle-steps] li")).toHaveCount(4);
});

for (const withProgress of [false, true])
  test(`on a phone the main way in is on the first screen (${withProgress ? "returning" : "new"} learner)`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "phone layout only");
    if (withProgress)
      await page.addInitScript(() =>
        localStorage.setItem("jifunze:progress:v1", JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": { completedAt: "2026-11-01T10:00:00.000Z" } } })),
      );
    await page.goto("/sw/");
    // New learners: the first starting tile. Returning learners: the Continue link, which sits above the tiles.
    const target = withProgress ? page.locator("[data-continue] a").first() : page.locator("[data-start] a").first();
    const box = (await target.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });

test("the hero action jumps to the starting tiles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  await page.getByRole("link", { name: "Where are you starting?" }).click();
  await expect(page).toHaveURL(/#anza$/);
  await expect(page.locator("#anza [data-start] a")).toHaveCount(4);
});
