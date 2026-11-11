import { expect, test } from "vitest";
import { flatLessons, getGlossary, getLesson, getQuiz, getRoadmap } from "../../lib/content/load.ts";

test("three progressive savings specializations provide complete bilingual lessons and scenario quizzes", () => {
  const roadmap = getRoadmap("savers");
  const sections = roadmap.sections.filter((s) => s.optional);
  expect(sections.map((s) => s.lessons.length)).toEqual([6, 5, 5]);
  expect(flatLessons(roadmap)).toHaveLength(24);
  for (const section of sections) {
    const levels = new Set<string>();
    for (const entry of section.lessons) {
      expect(entry.prerequisites?.length).toBeGreaterThan(0);
      for (const lang of ["en", "sw"] as const) {
        const lesson = getLesson("savers", entry.slug, lang);
        expect(lesson.isFallback).toBe(false);
        expect(lesson.frontmatter.objectives.length).toBeGreaterThanOrEqual(3);
        expect(lesson.frontmatter.reflection.length).toBeGreaterThanOrEqual(3);
        expect(lesson.frontmatter.resources.length).toBeGreaterThanOrEqual(1);
        expect(lesson.frontmatter.lastReviewed).toBeUndefined(); // No invented human sign-off.
        expect(lesson.body.split(/\s+/).length).toBeGreaterThan(lang === "en" ? 400 : 350);
        expect(lesson.body).toContain(lang === "en" ? "## Try it" : "## Jaribu");
        levels.add(lesson.frontmatter.level);
      }
      const quiz = getQuiz("savers", entry.slug)!;
      expect(quiz.questions).toHaveLength(4);
      for (const q of quiz.questions) for (const lang of ["en", "sw"] as const) {
        expect(q.prompt[lang].trim()).toBeTruthy();
        expect(q.explanation[lang].trim()).toBeTruthy();
        expect(q.options.find((o) => o.id === q.answer)?.label[lang]).toBeTruthy();
      }
    }
    expect([...levels].sort()).toEqual(["advanced", "beginner", "intermediate"]);
  }
  expect(getGlossary()).toHaveLength(57);
});
