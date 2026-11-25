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

test("the hero shows the savings circle steps in order", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check before you save");
  await expect(page.locator("[data-circle-steps] li")).toHaveText(["Learn how it works", "Check the group", "Save together", "Teach your chama"]);
  await page.goto("/sw/");
  await expect(page.locator("[data-circle-steps] li").first()).toHaveText("Jifunze jinsi inavyofanya kazi");
});

const circleStates = (page: import("@playwright/test").Page) =>
  page.locator("[data-circle]").evaluate((el) => el.getAnimations({ subtree: true }).map((a) => ({ state: a.playState, iterations: a.effect?.getTiming().iterations })));

test("the circle loops until the visitor interacts", async ({ page }) => {
  await page.goto("/en/");
  await page.waitForTimeout(1000);
  const states = await circleStates(page);
  expect(states.length).toBeGreaterThan(0);
  expect(states.every((s) => s.state === "running" && s.iterations === Infinity)).toBe(true);
});

test("pointing at a step pauses the circle on it, and moving away resumes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "hover needs a pointer");
  await page.goto("/en/");
  await page.locator('[data-circle-steps] li[data-step="2"]').hover();
  expect((await circleStates(page)).every((s) => s.state === "paused")).toBe(true);
  await expect(page.locator('[data-circle-steps] li[data-step="2"]')).toHaveCSS("background-color", "rgb(201, 68, 0)");
  await expect(page.locator('[data-circle-steps] li[data-step="1"]')).not.toHaveCSS("background-color", "rgb(201, 68, 0)");
  await page.mouse.move(5, 5);
  expect((await circleStates(page)).every((s) => s.state === "running")).toBe(true);
});

test("after choosing where to start, the circle stays stopped", async ({ page }) => {
  await page.goto("/en/");
  await page.getByRole("link", { name: "Where are you starting?" }).click();
  await expect(page).toHaveURL(/#anza$/);
  await page.mouse.move(5, 5);
  expect((await circleStates(page)).every((s) => s.state === "paused")).toBe(true);
});

test("the pause switch stops the circle without a mouse", async ({ page }) => {
  await page.goto("/en/");
  const pause = page.getByRole("checkbox", { name: "Pause animation" });
  await pause.focus();
  await page.keyboard.press("Space");
  await expect(pause).toBeChecked();
  expect((await circleStates(page)).every((s) => s.state === "paused")).toBe(true);
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

test("the homepage has one path card with its three specializations", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("[data-path-card]")).toHaveCount(1);
  await expect(page.locator("[data-path-card]")).toHaveAttribute("data-path-card", "savers");
  const chips = page.locator("[data-specializations] a");
  await expect(chips).toHaveCount(3);
  const hrefs = await chips.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual(["individual-savings", "community-savings", "cooperative-finance"].map((id) => `/en/savers/#tree-section-${id}`));
  await chips.nth(1).click();
  await expect(page.locator("#tree-section-community-savings")).toBeInViewport();
});

test("builders, lightning, the lab panel and resource cards are not on the homepage", async ({ page }) => {
  await page.goto("/en/");
  const main = page.locator("main");
  await expect(main.locator('a[href="/en/builders/"], a[href="/en/lightning/"]')).toHaveCount(0);
  await expect(main.locator("#labs-title, [data-loop], [data-resource], [data-glossary-terms]")).toHaveCount(0);
  expect(await page.locator('header a[href="/en/lightning/"]').count()).toBeGreaterThan(0); // header unchanged (owner decision 3)
});

for (const lang of ["en", "sw"] as const)
  test(`${lang}: three questions link to the lessons that answer them`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    const cards = page.locator("[data-questions] a");
    await expect(cards).toHaveCount(3);
    const hrefs = await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(["custody-and-fedimint", "cooperative-foundations", "payments-liquidity"].map((s) => `/${lang}/savers/${s}/`));
    if (lang === "en") await expect(cards.first()).toContainText("Who holds the money?");
  });

for (const lang of ["en", "sw"] as const)
  test(`${lang}: six savings-group names open to one line each`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    const items = page.locator("[data-world-list] details");
    await expect(items).toHaveCount(6);
    await items.first().locator("summary").click();
    await expect(items.first()).toHaveAttribute("open", "");
    await expect(page.locator("[data-world]")).toContainText(lang === "en" ? "Names do not mean identical rules or legal status." : "Majina hayamaanishi sheria au hali ya kisheria iliyo sawa.");
  });
