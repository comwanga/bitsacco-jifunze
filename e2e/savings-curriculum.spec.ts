import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getQuiz, getRoadmap } from "../lib/content/load";
import { t } from "../lib/i18n";
import { discussionCopy } from "../lib/discussion-copy";

for (const lang of ["en", "sw"] as const) {
  test(`${lang}: intro completion offers specialization choice and branch navigation stays within the choice`, async ({ page }) => {
    await page.goto(`/${lang}/savers/`);
    const r = getRoadmap("savers");
    const core = r.sections.filter((s) => !s.optional).flatMap((s) => s.lessons);
    await page.evaluate((entries) => localStorage.setItem("jifunze:progress:v1", JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: Object.fromEntries(entries.map(({ slug }) => [`savers/${slug}`, { completedAt: "2026-11-11T00:00:00Z" }])) })), core);
    await page.reload();
    await expect(page.locator("[data-resume]")).toHaveText(t(lang, "chooseSpecialization"));
    await page.locator("[data-resume]").click();
    await expect(page).toHaveURL(/#specializations$/);
    const section = page.locator("#s-cooperative-finance");
    await section.getByText(t(lang, "optionalLessons"), { exact: true }).click();
    await section.locator(`a[href="/${lang}/savers/cooperative-foundations/"]`).click();
    await expect(page.locator(`a[href="/${lang}/savers/cooperative-balance-sheet/"]`).last()).toBeVisible();
    await page.goto(`/${lang}/savers/cooperative-recovery/`);
    await expect(page.getByRole("link", { name: t(lang, "chooseSpecialization"), exact: true })).toBeVisible();
    // There is no sequential Next link that sends this learner into a different specialization.
    await expect(page.locator('nav[aria-label] a').filter({ hasText: t(lang, "next") })).toHaveCount(0);
  });

  test(`${lang}: quiz alone does not bypass required discussion, and confirmation survives language switch`, async ({ page }) => {
    await page.goto(`/${lang}/savers/budget-resilience/`);
    const finish = page.getByRole("button", { name: t(lang, "markComplete"), exact: true });
    await expect(finish).toBeDisabled();
    const quiz = page.getByRole("region", { name: t(lang, "quizTitle"), exact: true });
    const questions = getQuiz("savers", "budget-resilience")!.questions;
    for (const [i,q] of questions.entries()) {
      await quiz.getByRole("radio", { name: q.options.find((o) => o.id === q.answer)!.label[lang], exact: true }).check();
      await quiz.getByRole("button", { name: t(lang, "quizCheck"), exact: true }).click();
      await quiz.getByRole("button", { name: t(lang, i < questions.length - 1 ? "quizNext" : "quizFinish"), exact: true }).click();
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons["savers/budget-resilience"].completedAt)).toBeUndefined();
    await expect(finish).toBeDisabled();
    await page.getByRole("button", { name: discussionCopy[lang].confirm, exact: true }).click();
    await expect(finish).toBeEnabled();
    const other = lang === "en" ? "sw" : "en";
    await page.locator(`header a[hreflang="${other}"]`).click();
    await expect(page.getByRole("button", { name: discussionCopy[other].done, exact: true })).toBeDisabled();
    await page.getByRole("button", { name: t(other, "markComplete"), exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons["savers/budget-resilience"]);
    expect(saved.reflectedAt).toBeTruthy(); expect(saved.completedAt).toBeTruthy(); expect(saved.quiz.correct).toBe(4);
  });

  test(`${lang}: new content remains readable without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
    const page = await context.newPage();
    await page.goto(`/${lang}/savers/`);
    const section = page.locator("#s-community-savings");
    await section.getByText(t(lang, "optionalLessons"), { exact: true }).click();
    await section.locator(`a[href="/${lang}/savers/group-governance/"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: t(lang, "reflection"), exact: true })).toBeVisible();
    await context.close();
  });

  test(`${lang}: specialization navigation and new lesson pass tested Axe rules at 360px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 360, height: 800 });
    for (const route of ["savers/", "tree/savers/", "savers/cooperative-balance-sheet/"]) {
      await page.goto(`/${lang}/${route}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations).toEqual([]);
    }
  });
}
