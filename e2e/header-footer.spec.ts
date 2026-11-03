import { expect, test, type Page } from "@playwright/test";

// Layout checks for the header and footer refinement, at the widths the brief names.
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test.describe("header and footer layout", () => {
  test.skip(({ isMobile }) => isMobile, "these tests set their own viewports");

  test("on wide screens the brand sits near the left and the navigation groups with the language switch", async ({ page }) => {
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/en/glossary/");
      const brand = await box(page, "header [data-brand]");
      expect(brand.x, `brand left at ${width}`).toBeGreaterThanOrEqual(16);
      expect(brand.x, `brand left at ${width}`).toBeLessThanOrEqual(width >= 1600 ? 260 : 48);
      const links = page.getByRole("navigation", { name: "Menu" }).getByRole("link");
      const last = (await links.last().boundingBox())!;
      const lang = await box(page, 'header a[hreflang="sw"]');
      expect(lang.x - (last.x + last.width), `nav to language at ${width}`).toBeLessThanOrEqual(48);
      expect(lang.x - (last.x + last.width), `nav to language at ${width}`).toBeGreaterThan(0);
    }
  });

  test("at tablet and small-laptop widths nothing in the header overlaps or overflows", async ({ page }) => {
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/sw/glossary/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `overflow at ${width}`).toBeLessThanOrEqual(0);
      const brand = await box(page, "header [data-brand]");
      const lang = await box(page, 'header a[hreflang="en"]');
      expect(lang.x, `language clears brand at ${width}`).toBeGreaterThan(brand.x + brand.width);
    }
  });

  test("the header does not animate while scrolling", async ({ page }) => {
    await page.goto("/en/");
    expect(await page.locator("header[data-site-header]").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("the footer is compact and keeps the legal text together", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en/glossary/");
    expect((await box(page, "footer")).height).toBeLessThanOrEqual(300);
    const disclaimer = await box(page, "footer [data-footer-legal] p:first-child");
    const licence = await box(page, "footer [data-footer-legal] p:last-child");
    expect(licence.x - (disclaimer.x + disclaimer.width)).toBeLessThanOrEqual(48);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/glossary/");
    expect((await box(page, "footer")).height).toBeLessThanOrEqual(560);
  });

  test("the footer says which link is the live lab and which is browser practice", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.locator("footer").getByRole("link", { name: "Lightning lab" })).toHaveAttribute("href", "/en/lightning/");
    await expect(page.locator("footer").getByRole("link", { name: "Practice simulations" })).toHaveAttribute("href", "/en/simulations/");
    await page.goto("/sw/");
    await expect(page.locator("footer").getByRole("link", { name: "Maabara ya Lightning" })).toHaveAttribute("href", "/sw/lightning/");
    await expect(page.locator("footer").getByRole("link", { name: "Mazoezi ya Bitcoin" })).toHaveAttribute("href", "/sw/simulations/");
  });
});

test("the current section is marked in the served HTML, before any script runs", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4321/sw/glossary/");
  await expect(page.getByRole("navigation", { name: "Menyu" }).locator('[aria-current="page"]')).toHaveText("Kamusi");
  await page.goto("http://localhost:4321/en/tree/lightning/");
  await expect(page.getByRole("navigation", { name: "Menu" }).locator('[aria-current="page"]')).toHaveText("Labs");
  await ctx.close();
});
