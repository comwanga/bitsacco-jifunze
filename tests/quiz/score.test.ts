import { expect, test } from "vitest";
import { scoreQuiz } from "../../lib/quiz/score.ts";
import type { QuizFile } from "../../lib/content/schemas.ts";

const L = { sw: "x", en: "x" };
const q = (id: string, answer: string) => ({
  id,
  prompt: L,
  options: [{ id: "a", label: L }, { id: "b", label: L }],
  answer,
  explanation: L,
});
const quiz: QuizFile = { lesson: "x", questions: [q("q1", "a"), q("q2", "b"), q("q3", "a")] };

test("scores right, wrong and unanswered questions", () => {
  expect(scoreQuiz(quiz, { q1: "a", q2: "a" })).toEqual({
    correct: 1,
    total: 3,
    results: { q1: true, q2: false, q3: false },
  });
});
