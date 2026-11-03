import path from "node:path";
import { describe, expect, test } from "vitest";
import { flatLessons, getGlossary, getLesson, getLibrary, getQuiz, getRoadmap, listRoadmaps } from "../../lib/content/load.ts";
import { LessonFrontmatterSchema } from "../../lib/content/schemas.ts";
import { dict } from "../../lib/i18n.ts";

const FIX = path.join(import.meta.dirname, "../fixtures/content");

describe("roadmaps", () => {
  test("getRoadmap reads sections", () => {
    const r = getRoadmap("savers", FIX);
    expect(r.sections.map((s) => s.id)).toEqual(["basics", "more"]);
  });
  test("flatLessons lists slugs in order", () => {
    expect(flatLessons(getRoadmap("savers", FIX))).toEqual(["alpha", "beta", "gamma"]);
  });
  test("listRoadmaps finds every roadmap file", () => {
    expect(listRoadmaps(FIX).map((r) => r.id)).toEqual(["savers"]);
  });
});

describe("lessons", () => {
  test("serves the requested language when it exists", () => {
    const l = getLesson("savers", "alpha", "sw", FIX);
    expect(l.servedLang).toBe("sw");
    expect(l.isFallback).toBe(false);
    expect(l.frontmatter.title).toBe("Alfa");
    expect(l.body).not.toContain("objectives:");
    expect(l.body).toContain("Body of Alfa");
  });
  test("falls back to the other language for translationPending lessons", () => {
    const l = getLesson("savers", "beta", "sw", FIX);
    expect(l.servedLang).toBe("en");
    expect(l.isFallback).toBe(true);
    expect(l.frontmatter.translationPending).toBe(true);
  });
  test("throws for unknown lessons", () => {
    expect(() => getLesson("savers", "nope", "sw", FIX)).toThrow(/Lesson not found: savers\/nope/);
  });
  test("front matter schema rejects a non-numeric minutes value", () => {
    const valid = getLesson("savers", "alpha", "en", FIX).frontmatter;
    expect(LessonFrontmatterSchema.safeParse(valid).success).toBe(true);
    expect(LessonFrontmatterSchema.safeParse({ ...valid, minutes: "ten" }).success).toBe(false);
  });
});

describe("quizzes, glossary, library", () => {
  test("getQuiz returns null when no quiz exists", () => {
    expect(getQuiz("savers", "gamma", FIX)).toBeNull();
  });
  test("quiz answers reference an option", () => {
    const q = getQuiz("savers", "alpha", FIX)!.questions[0];
    expect(q.options.map((o) => o.id)).toContain(q.answer);
  });
  test("glossary and library load", () => {
    expect(getGlossary(FIX).map((g) => g.id)).toEqual(["sats", "seed-phrase"]);
    expect(getLibrary(FIX)[0].sizeBytes).toBe(184292);
  });
});

describe("i18n", () => {
  test("sw and en dictionaries have identical keys", () => {
    expect(Object.keys(dict.en).sort()).toEqual(Object.keys(dict.sw).sort());
  });
});
