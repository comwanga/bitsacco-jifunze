import { expect, test, type Page } from "@playwright/test";
import { accountCopy } from "../lib/account-copy";
import { t } from "../lib/i18n";

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

  test("the footer remains compact on desktop and phone", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en/glossary/");
    expect((await box(page, "footer")).height).toBeLessThanOrEqual(300);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/glossary/");
    expect((await box(page, "footer")).height).toBeLessThanOrEqual(560);
  });

  for (const lang of ["en", "sw"] as const) for (const width of [390, 768, 1280, 1920]) {
    test(`${lang}: shared footer follows content and aligns legal information at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const route of ["account/", "offline/", "", "account/signin/", "savers/money-and-bitcoin/", "glossary/"]) {
        await test.step(route || "homepage", async () => {
          await page.goto(`/${lang}/${route}`);
          if (route === "account/") {
            // The static test server has no account service. Keep that separate runtime error visible.
            await expect(page.getByRole("main").getByRole("alert")).toContainText(accountCopy[lang].error_network);
          }
          if (route === "account/signin/") await expect(page.locator("#nostr-help")).toBeVisible();
          await expect(page.getByRole("contentinfo")).toHaveCount(1);
          const layout = await page.evaluate(() => {
            const rect = (el: Element) => {
              const r = el.getBoundingClientRect();
              return { x: r.x, y: r.y + scrollY, right: r.right, bottom: r.bottom + scrollY };
            };
            const footer = document.querySelector("footer")!;
            const legal = footer.querySelector("[data-footer-legal]")!;
            return {
              header: rect(document.querySelector("header")!), main: rect(document.querySelector("main")!),
              footer: rect(footer), legal: rect(legal),
              disclaimer: rect(legal.firstElementChild!), licence: rect(legal.lastElementChild!),
              height: innerHeight, documentHeight: document.documentElement.scrollHeight,
              overflow: document.documentElement.scrollWidth - innerWidth,
              footerPosition: getComputedStyle(footer).position,
            };
          });
          expect(layout.overflow).toBeLessThanOrEqual(0);
          expect(layout.main.y).toBeGreaterThanOrEqual(layout.header.bottom);
          expect(layout.footer.y).toBeGreaterThanOrEqual(layout.main.bottom - 1);
          expect(layout.footer.bottom).toBeGreaterThanOrEqual(layout.height - 1);
          expect(Math.abs(layout.footer.bottom - layout.documentHeight)).toBeLessThanOrEqual(1);
          expect(["fixed", "absolute"]).not.toContain(layout.footerPosition);
          if (width >= 768 && ["account/", "offline/"].includes(route)) {
            expect(layout.documentHeight).toBe(layout.height);
          }
          const legal = page.locator("[data-footer-legal]");
          await expect(legal.locator("p:first-child")).toHaveText(t(lang, "footerNoAdvice"));
          await expect(legal.locator("p:last-child")).toHaveText(t(lang, "footerLicence"));
          expect(layout.disclaimer.x).toBe(layout.legal.x);
          if (width >= 768) {
            expect(layout.licence.right).toBeCloseTo(layout.legal.right, 0);
            expect(layout.licence.y).toBeCloseTo(layout.disclaimer.y, 0);
            expect(layout.licence.x - layout.disclaimer.right).toBeGreaterThanOrEqual(23);
          } else {
            expect(layout.licence.x).toBe(layout.legal.x);
            expect(layout.licence.y - layout.disclaimer.bottom).toBeGreaterThanOrEqual(3);
          }
        });
      }
      const learning = page.locator(`footer a[href="/${lang}/learn/"]`);
      await learning.focus();
      await expect(learning).toBeFocused();
      await learning.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/${lang}/learn/$`));
    });
  }

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
