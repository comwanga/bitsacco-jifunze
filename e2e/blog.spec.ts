import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SLUG = "chama-loses-wallet-access";
const LESSONS = ["savers/group-multisig", "savers/group-treasury", "savers/custody-recovery"];

for (const lang of ["sw", "en"] as const) {
  const label = lang === "sw" ? "Makala" : "Blog";
  const post = `/${lang}/blog/${SLUG}/`;

  test(`${lang}: the header leads to ${label} and the index lists the launch post`, async ({ page, isMobile }) => {
    await page.goto(`/${lang}/`);
    if (isMobile) await page.locator("header summary", { hasText: lang === "sw" ? "Menyu" : "Menu" }).click();
    await page.getByRole("navigation", { name: lang === "sw" ? "Menyu" : "Menu" }).getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog/$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
    const card = page.locator(`[data-blog-card="${SLUG}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByRole("link")).toHaveAttribute("href", post);
  });

  test(`${lang}: the post leads into its lessons, and each lesson exists`, async ({ page, request }) => {
    await page.goto(post);
    const links = page.locator("a[data-continue-lesson]");
    await expect(links).toHaveCount(LESSONS.length);
    for (const [i, lesson] of LESSONS.entries()) {
      await expect(links.nth(i)).toHaveAttribute("href", `/${lang}/${lesson}/`);
      expect((await request.get(`/${lang}/${lesson}/`)).status()).toBe(200);
    }
  });

  test(`${lang}: a diagram marker opens its explanation below the image and Escape returns focus`, async ({ page }) => {
    await page.goto(post);
    const figure = page.locator("figure[data-diagram]");
    const marker = figure.locator('button[data-marker="1"]');
    await expect(marker).toBeVisible();
    await marker.click();
    await expect(marker).toHaveAttribute("aria-expanded", "true");
    const panel = figure.locator("[data-diagram-panel]");
    const note = (await figure.locator("ol[data-diagram-notes] > li").first().locator("strong").textContent())!.trim();
    await expect(panel).toContainText(note);
    const image = (await figure.locator("img").boundingBox())!;
    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.y).toBeGreaterThanOrEqual(image.y + image.height - 1);
    await page.keyboard.press("Escape");
    await expect(marker).toHaveAttribute("aria-expanded", "false");
    await expect(marker).toBeFocused();
  });

  test(`${lang}: the language switch keeps the post`, async ({ page }) => {
    await page.goto(post);
    const other = lang === "sw" ? "en" : "sw";
    await page.locator(`header a[hreflang="${other}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/${other}/blog/${SLUG}/$`));
  });

  test(`${lang}: blog pages fit a 360 px phone, pass axe and make no outside requests`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    const outside: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith(new URL(page.url() === "about:blank" ? "http://localhost:4321" : page.url()).origin)) outside.push(r.url()); });
    for (const path of [`/${lang}/blog/`, post]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact!))).toEqual([]);
    }
    expect(outside.filter((u) => !u.startsWith("data:"))).toEqual([]);
    expect(await page.locator("iframe").count()).toBe(0);
    await context.close();
  });
}

test("without JavaScript every post and every diagram explanation is readable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/blog/");
  await expect(page.locator(`[data-blog-card="${SLUG}"]`)).toBeVisible();
  await page.goto(`/en/blog/${SLUG}/`);
  const notes = page.locator("figure[data-diagram] ol[data-diagram-notes] > li");
  await expect(notes).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(notes.nth(i)).toBeVisible();
  await expect(page.locator("figure[data-diagram] button")).toHaveCount(0);
  await context.close();
});

test("a post read online reloads offline with its diagram", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "one browser is enough for the service worker");
  const post = `/en/blog/${SLUG}/`;
  await page.goto("/en/blog/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.goto(post);
  await expect(page.locator("figure[data-diagram] img")).toBeVisible();
  await page.waitForFunction(async (p) => Boolean(await (await caches.open("pages-v1")).match(p)), post);
  await page.waitForFunction(async () => Boolean(await caches.match("/images/blog/chama-treasury-en.svg")));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("wallet");
  expect(await page.locator("figure[data-diagram] img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await context.setOffline(false);
});
