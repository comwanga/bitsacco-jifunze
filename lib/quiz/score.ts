import type { QuizFile } from "../content/schemas.ts";

export function scoreQuiz(
  quiz: QuizFile,
  answers: Record<string, string>,
): { correct: number; total: number; results: Record<string, boolean> } {
  const results: Record<string, boolean> = {};
  let correct = 0;
  for (const q of quiz.questions) {
    const ok = answers[q.id] === q.answer;
    results[q.id] = ok;
    if (ok) correct++;
  }
  return { correct, total: quiz.questions.length, results };
}
