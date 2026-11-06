import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { flatLessons, getLesson, listRoadmaps } from "../lib/content/load";

for (const lang of ["en", "sw"] as const) test(`${lang}: library offers the official English third edition and clearly marks the pending translation`, async ({ page }) => {
  const pdfRequests: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname.endsWith(".pdf")) pdfRequests.push(r.url()); });
  await page.goto(`/${lang}/library/`);
  const english = page.locator("#mastering-bitcoin-en");
  await expect(english).toContainText("Andreas M. Antonopoulos & David A. Harding");
  await expect(english).toContainText("CC BY-SA 4.0");
  const link = english.getByRole("link", { name: lang === "en" ? "Read PDF here" : "Soma PDF hapa" });
  await expect(link).toHaveAttribute("href", `/${lang}/library/mastering-bitcoin-en/`);
  const download = english.locator('a[type="application/pdf"]');
  await expect(download).toHaveAttribute("href", "/books/mastering-bitcoin-en-3rd-edition.pdf");
  await expect(download).toHaveAttribute("download", "mastering-bitcoin-en-3rd-edition.pdf");
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

for (const lang of ["en", "sw"] as const) test(`${lang}: every lesson companion reference opens the pending publication notice instead of a missing PDF`, async ({ page }) => {
  test.setTimeout(90_000); // Each case follows all 15 references, rather than a representative lesson.
  const references = listRoadmaps().flatMap(roadmap => flatLessons(roadmap).flatMap(slug =>
    getLesson(roadmap.id, slug, lang).frontmatter.resources
      .filter(resource => resource.title.startsWith("Kujifunza Bitcoin"))
      .map(resource => ({ path: `/${lang}/${roadmap.id}/${slug}/`, title: resource.title })),
  ));
  expect(references).toHaveLength(15);
  const pdfRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".pdf")) pdfRequests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  for (const reference of references) {
    await page.goto(reference.path);
    const link = page.locator('section[aria-labelledby="res"]').getByRole("link", { name: reference.title, exact: true });
    await expect(link).toHaveAttribute("href", "/sw/library/#kujifunza-bitcoin");
    await expect(link.locator("xpath=ancestor::li")).toContainText(lang === "en" ? "not a PDF download" : "si upakuaji wa PDF");
    await link.click();
    await expect(page).toHaveURL(/\/sw\/library\/#kujifunza-bitcoin$/);
    const notice = page.locator("#kujifunza-bitcoin");
    await expect(notice).toContainText("inasubiri kuchapishwa rasmi");
    await expect(notice).toContainText("Andreas M. Antonopoulos & David A. Harding");
    await expect(notice).toContainText("comwanga");
    await expect(notice.getByRole("link")).toHaveCount(0);
  }
  expect(pdfRequests).toEqual([]);
  expect(errors).toEqual([]);
});
