import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { flatLessons, getLesson, listRoadmaps } from "../lib/content/load";

for (const lang of ["en", "sw"] as const) test(`${lang}: library offers both third editions with a reader page and a verified local download`, async ({ page }) => {
  const pdfRequests: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname.endsWith(".pdf")) pdfRequests.push(r.url()); });
  await page.goto(`/${lang}/library/`);
  for (const [id, file] of [["mastering-bitcoin-en", "mastering-bitcoin-en-3rd-edition.pdf"], ["kujifunza-bitcoin", "kujifunza-bitcoin-sw-3rd-edition.pdf"]]) {
    const item = page.locator(`#${id}`);
    await expect(item).toContainText("Andreas M. Antonopoulos & David A. Harding");
    await expect(item).toContainText("CC BY-SA 4.0");
    const link = item.getByRole("link", { name: lang === "en" ? "Read PDF here" : "Soma PDF hapa" });
    await expect(link).toHaveAttribute("href", `/${lang}/library/${id}/`);
    const download = item.locator('a[type="application/pdf"]');
    await expect(download).toHaveAttribute("href", `/books/${file}`);
    await expect(download).toHaveAttribute("download", file);
    await link.focus();
    await expect(link).toBeFocused();
  }
  await expect(page.locator("#kujifunza-bitcoin")).toContainText("comwanga");
  // Nothing in the library is pending now, so nothing carries the "Coming soon" treatment.
  await expect(page.locator("li[data-pending]")).toHaveCount(0);
  await expect(page.locator('a[href*="kujifunza-bitcoin-sw.pdf"]')).toHaveCount(0);
  expect(pdfRequests).toEqual([]);
  expect(new URL(page.url()).pathname).toBe(`/${lang}/library/`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
});

for (const lang of ["en", "sw"] as const) test(`${lang}: every lesson companion reference opens the Kiswahili book page without downloading the PDF`, async ({ page }) => {
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
    await expect(link).toHaveAttribute("href", "/sw/library/kujifunza-bitcoin/");
    await expect(link.locator("xpath=ancestor::li")).toContainText(lang === "en" ? "read or download it" : "kukisoma au kukipakua");
    await link.click();
    await expect(page).toHaveURL(/\/sw\/library\/kujifunza-bitcoin\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kujifunza Bitcoin");
    await expect(page.getByText("comwanga", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Soma PDF", exact: true })).toBeVisible();
  }
  expect(pdfRequests).toEqual([]); // The book loads only when the learner chooses to read or download it.
  expect(errors).toEqual([]);
});
