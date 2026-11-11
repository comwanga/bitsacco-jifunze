import { expect, test } from "@playwright/test";

const LESSON = "/sw/savers/money-and-bitcoin/";

test("the table of contents jumps to its heading", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sidebars show on wide screens");
  await page.goto(LESSON);
  const toc = page.getByRole("navigation", { name: "Ukurasa huu" });
  await expect(toc).toBeVisible();
  const entry = toc.getByRole("link").nth(1);
  const href = await entry.getAttribute("href");
  expect(href).toMatch(/^#/);
  await entry.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator(href!)).toBeInViewport();
});

test("the course sidebar marks the current lesson", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sidebars show on wide screens");
  await page.goto(LESSON);
  const course = page.getByRole("navigation", { name: "Masomo" });
  await expect(course.locator('[aria-current="page"]')).toHaveAttribute("href", LESSON);
});

test("on a phone, 'On this page' opens to show the links", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone menus only");
  await page.goto(LESSON);
  const summary = page.locator("summary", { hasText: "Ukurasa huu" });
  await expect(summary).toBeVisible();
  const links = page.getByRole("navigation", { name: "Ukurasa huu" }).getByRole("link");
  await expect(links.first()).toBeHidden();
  await summary.click();
  await expect(links.first()).toBeVisible();
  await links.nth(1).click();
  await expect(links.first()).toBeHidden(); // the menu closes after a jump
});

test("the reading progress bar fills as you scroll", async ({ page }) => {
  await page.goto(LESSON);
  const bar = page.locator("[data-reading-progress]");
  const before = await bar.evaluate((el) => getComputedStyle(el).transform);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => bar.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
});

test("on a phone, opening one lesson menu closes the other", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone menus only");
  await page.goto(LESSON);
  const course = page.locator("details[data-lesson-menu]").nth(0);
  const toc = page.locator("details[data-lesson-menu]").nth(1);
  await course.locator(":scope > summary").click();
  await expect(course).toHaveAttribute("open", "");
  await toc.locator(":scope > summary").click();
  await expect(toc).toHaveAttribute("open", "");
  await expect(course).not.toHaveAttribute("open", "");
});
