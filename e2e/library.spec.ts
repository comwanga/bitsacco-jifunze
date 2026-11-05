import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const officialBook = "https://github.com/bitcoinbook/bitcoinbook/blob/275c4eb8eab8800c6adc39f8def8e8f8fa356a57/BOOK.md";
for (const lang of ["en", "sw"] as const) test(`${lang}: library offers the official English third edition and clearly marks the pending translation`, async ({ page }) => {
  const pdfRequests: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname.endsWith(".pdf")) pdfRequests.push(r.url()); });
  await page.goto(`/${lang}/library/`);
  const english = page.locator("#mastering-bitcoin-en");
  await expect(english).toContainText("Andreas M. Antonopoulos & David A. Harding");
  await expect(english).toContainText("CC BY-SA 4.0");
  const link = english.getByRole("link");
  await expect(link).toHaveAttribute("href", officialBook);
  await expect(link).not.toHaveAttribute("type", "application/pdf");
  await expect(link).toContainText(lang === "en" ? "Read online" : "Soma mtandaoni");
  await link.focus();
  await expect(link).toBeFocused();
  const pending = page.locator("#kujifunza-bitcoin");
  await expect(pending).toContainText(lang === "en" ? "awaits official publication" : "inasubiri kuchapishwa rasmi");
  await expect(pending.getByRole("link")).toHaveCount(0);
  await expect(page.locator('a[href*="kujifunza-bitcoin-sw.pdf"]')).toHaveCount(0);
  expect(pdfRequests).toEqual([]);
  expect(new URL(page.url()).pathname).toBe(`/${lang}/library/`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
});
