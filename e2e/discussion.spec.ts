import { expect, test } from "@playwright/test";
import { getQuiz } from "../lib/content/load";
import { discussionCopy } from "../lib/discussion-copy";
import { t } from "../lib/i18n";

for (const lang of ["en", "sw"] as const) {
  test(`${lang}: required discussion gates an existing lesson and supports keyboard confirmation`, async ({ page }) => {
    await page.goto(`/${lang}/savers/money-and-bitcoin/`);
    const finish = page.getByRole("button", { name: t(lang, "markComplete"), exact: true });
    await expect(finish).toBeDisabled();
    const quiz = page.getByRole("region", { name: t(lang, "quizTitle"), exact: true });
    const questions = getQuiz("savers", "money-and-bitcoin")!.questions;
    for (const [i, q] of questions.entries()) {
      await quiz.getByRole("radio", { name: q.options.find((o) => o.id === q.answer)!.label[lang], exact: true }).check();
      await quiz.getByRole("button", { name: t(lang, "quizCheck"), exact: true }).click();
      await quiz.getByRole("button", { name: t(lang, i < questions.length - 1 ? "quizNext" : "quizFinish"), exact: true }).click();
    }
    await expect(finish).toBeDisabled();
    const confirm = page.getByRole("button", { name: discussionCopy[lang].confirm, exact: true });
    await confirm.focus();
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(finish).toBeEnabled();
    await finish.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('p[aria-live="polite"]').filter({ hasText: t(lang, "markedComplete") })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons["savers/money-and-bitcoin"]);
    expect(saved.completedAt).toBeTruthy();
    expect(saved.reflectedAt).toBeTruthy();
    expect(saved.quiz.correct).toBe(questions.length);
    expect(Object.keys(saved).sort()).toEqual(["completedAt", "quiz", "reflectedAt"]);
    await expect(page.locator('textarea, input[type="text"]')).toHaveCount(0);
  });

  test(`${lang}: historical completion remains complete without a new confirmation`, async ({ page }) => {
    const completedAt = "2026-01-01T00:00:00.000Z";
    await page.addInitScript((stamp) => localStorage.setItem("jifunze:progress:v1", JSON.stringify({
      app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": { completedAt: stamp } },
    })), completedAt);
    await page.goto(`/${lang}/savers/money-and-bitcoin/`);
    await expect(page.locator('p[aria-live="polite"]').filter({ hasText: t(lang, "markedComplete") })).toBeVisible();
    await expect(page.getByRole("button", { name: discussionCopy[lang].done, exact: true })).toBeDisabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons["savers/money-and-bitcoin"])).toEqual({ completedAt });
  });
}
