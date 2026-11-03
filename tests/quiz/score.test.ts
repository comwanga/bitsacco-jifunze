import { expect, test } from "vitest";
import { quizPassed, scoreQuiz } from "../../lib/quiz/score.ts";
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

test("a quiz passes at 75 percent and an empty quiz never passes", () => {
  expect(quizPassed(3, 4)).toBe(true);
  expect(quizPassed(2, 4)).toBe(false);
  expect(quizPassed(0, 0)).toBe(false);
  expect(quizPassed(4, 4)).toBe(true);
});

test("scores right, wrong and unanswered questions", () => {
  expect(scoreQuiz(quiz, { q1: "a", q2: "a" })).toEqual({
    correct: 1,
    total: 3,
    results: { q1: true, q2: false, q3: false },
  });
});
