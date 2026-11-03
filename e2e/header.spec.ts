import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test.describe("desktop header", () => {
  test.skip(({ isMobile }) => isMobile, "wide screens only");

  test("brand, navigation and language switch share one compact row", async ({ page }) => {
    await page.goto("/en/");
    const header = await box(page, "header[data-site-header]");
    expect(header.height).toBeLessThanOrEqual(72);
    const nav = page.getByRole("navigation", { name: "Menu" });
    await expect(nav.getByRole("link")).toHaveText(["Paths", "Labs", "Library", "Glossary", "Progress"]);
    const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
    for (const sel of ["header [data-brand]", 'header a[hreflang="sw"]']) {
      expect(Math.abs(centre(await box(page, sel)) - centre(header))).toBeLessThan(8);
    }
    expect(Math.abs(centre((await nav.getByRole("link").first().boundingBox())!) - centre(header))).toBeLessThan(8);
  });

  test("the current section is marked in the navigation", async ({ page }) => {
    await page.goto("/en/glossary/");
    await expect(page.getByRole("navigation", { name: "Menu" }).locator('[aria-current="page"]')).toHaveText("Glossary");
    await page.goto("/en/savers/");
    await expect(page.getByRole("navigation", { name: "Menu" }).locator('[aria-current="page"]')).toHaveText("Paths");
    await page.goto("/en/lightning/routing-htlcs/");
    await expect(page.getByRole("navigation", { name: "Menu" }).locator('[aria-current="page"]')).toHaveText("Labs");
  });

  test("lesson sidebars start below the header", async ({ page }) => {
    await page.goto("/sw/savers/money-and-bitcoin/");
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(300);
    const header = await box(page, "header[data-site-header]");
    const toc = (await page.getByRole("navigation", { name: "Ukurasa huu" }).boundingBox())!;
    expect(toc.y).toBeGreaterThanOrEqual(header.y + header.height);
  });
});

test("the header stays pinned with the brand visible, without changing height", async ({ page }) => {
  await page.goto("/en/");
  const before = await box(page, "header[data-site-header]");
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(300);
  const after = await box(page, "header[data-site-header]");
  expect(after.y).toBe(0);
  expect(after.height).toBe(before.height);
  const brand = await box(page, "header [data-brand]");
  expect(brand.y).toBeGreaterThanOrEqual(0);
  expect(brand.x).toBeGreaterThanOrEqual(12);
});

test("jumping to the paths leaves the first path heading below the header", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  await page.getByRole("link", { name: "Start learning" }).click();
  await expect(page).toHaveURL(/#njia$/);
  await page.waitForTimeout(300);
  const header = await box(page, "header[data-site-header]");
  const heading = await box(page, "[data-path-card] h3");
  expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height);
});

test("a table-of-contents jump is not hidden behind the header or lesson bar", async ({ page, isMobile }) => {
  await page.goto("/sw/savers/money-and-bitcoin/");
  if (isMobile) {
    await page.locator("summary", { hasText: "Ukurasa huu" }).click();
  }
  const entry = page.getByRole("navigation", { name: "Ukurasa huu" }).getByRole("link").nth(2);
  const href = (await entry.getAttribute("href"))!;
  await entry.click();
  await page.waitForTimeout(400);
  const target = await box(page, href);
  const header = await box(page, "header[data-site-header]");
  let floor = header.y + header.height;
  if (isMobile) {
    const bar = await box(page, "[data-lesson-bar]");
    floor = bar.y + bar.height;
  }
  expect(target.y).toBeGreaterThanOrEqual(floor - 1);
});

test.describe("phone header", () => {
  test.skip(({ isMobile }) => !isMobile, "phones only");

  test("brand, language switch and a menu button fit on one line", async ({ page }) => {
    await page.goto("/sw/");
    await expect(page.locator("header [data-brand]")).toBeVisible();
    await expect(page.locator('header a[hreflang="en"]')).toBeVisible();
    await expect(page.locator("header summary", { hasText: "Menyu" })).toBeVisible();
    await expect(page.locator("header [data-brand]")).toContainText("na Bitsacco");
    expect((await box(page, "header[data-site-header]")).height).toBeLessThanOrEqual(64);
  });

  test("the menu opens by touch, navigates, and is closed on the next page", async ({ page }) => {
    await page.goto("/en/");
    const menu = page.locator("header details[data-site-menu]");
    const link = menu.getByRole("link", { name: "Glossary" });
    await expect(link).toBeHidden();
    await menu.locator("summary").tap();
    await expect(link).toBeVisible();
    await link.tap();
    await expect(page).toHaveURL(/\/en\/glossary\/$/);
    await expect(menu).not.toHaveAttribute("open", "");
    await expect(menu.locator('a[href="/en/glossary/"]')).toHaveAttribute("aria-current", "page");
  });

  test("the menu works from the keyboard and Escape returns focus to it", async ({ page }) => {
    await page.goto("/en/");
    const menu = page.locator("header details[data-site-menu]");
    const summary = menu.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(menu.getByRole("link", { name: "Paths" })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(menu.getByRole("link", { name: "Paths" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open", "");
    await expect(summary).toBeFocused();
  });

  test("the open menu has no serious accessibility problems", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/sw/");
    await page.locator("header details[data-site-menu] summary").click();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).include("header").analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  });
});

test("nothing scrolls sideways at 360px, menu open or closed", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const path of ["/sw/", "/en/", "/sw/savers/money-and-bitcoin/", "/en/lightning/routing-htlcs/"]) {
    await page.goto(path);
    await page.locator("header details[data-site-menu] summary").click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test("at 360px the phone header row keeps spare width for wider fonts", async ({ browser }) => {
  // CI's Linux fonts render about 11px wider than Windows; Android's Roboto/Noto are wider still.
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  for (const path of ["/en/simulations/utxo/", "/sw/simulations/utxo/", "/en/", "/sw/glossary/"]) {
    await page.goto(path);
    const need = await page.evaluate(() => {
      const brand = document.querySelector("header [data-brand]")!;
      const row = brand.parentElement!;
      const group = row.lastElementChild!;
      const s = getComputedStyle(row);
      return parseFloat(s.paddingLeft) + brand.getBoundingClientRect().width + parseFloat(s.columnGap) + group.getBoundingClientRect().width + parseFloat(s.paddingRight);
    });
    expect(need, `${path} header needs ${need.toFixed(0)}px`).toBeLessThanOrEqual(360 - 24);
  }
  await ctx.close();
});
