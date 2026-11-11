import { expect, test } from "@playwright/test";
import { getQuiz } from "../lib/content/load";

for (const scenario of [
  { roadmap: "savers", slug: "money-and-bitcoin", pass: true, completes: true },
  { roadmap: "savers", slug: "money-and-bitcoin", pass: false, completes: false },
  { roadmap: "lightning", slug: "routing-htlcs", pass: true, completes: false },
] as const) {
  test(`${scenario.roadmap}/${scenario.slug}: ${scenario.pass ? "passing" : "failing"} quiz ${scenario.completes ? "completes" : "does not complete"} the lesson`, async ({ page }) => {
    await page.goto(`/en/${scenario.roadmap}/${scenario.slug}/`);
    await page.getByRole("button", { name: "I have written or discussed reasoned answers", exact: true }).click();
    const questions = getQuiz(scenario.roadmap, scenario.slug)!.questions;
    const correctCount = scenario.pass ? Math.ceil(questions.length * 0.75) : 0;
    const quiz = page.getByRole("region", { name: "Check yourself" });
    for (const [i, q] of questions.entries()) {
      const option = q.options.find((o) => i < correctCount ? o.id === q.answer : o.id !== q.answer)!;
      await quiz.getByRole("radio", { name: option.label.en, exact: true }).check();
      await quiz.getByRole("button", { name: "Check answer", exact: true }).click();
      await quiz.getByRole("button", { name: i < questions.length - 1 ? "Next question" : "Finish", exact: true }).click();
    }
    await expect(quiz.getByText(`You got ${correctCount} of ${questions.length}`, { exact: true })).toBeVisible();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons[key], `${scenario.roadmap}/${scenario.slug}`);
    expect(saved.quiz.correct).toBe(correctCount);
    expect(Boolean(saved.completedAt)).toBe(scenario.completes);
  });
}
