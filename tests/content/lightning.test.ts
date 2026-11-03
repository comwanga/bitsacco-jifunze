import path from "node:path";
import { describe, expect, test } from "vitest";
import { getExercise, getRoadmap, listRoadmaps } from "../../lib/content/load.ts";
import { validateContent } from "../../lib/content/validate.ts";
import { emptyProgress, parseProgressFile, recordLabPass, serializeProgress } from "../../lib/progress/model.ts";

const FIX = path.join(import.meta.dirname, "../fixtures/content");
const BROKEN = path.join(import.meta.dirname, "../fixtures/broken");
const CHECKS = path.join(import.meta.dirname, "../fixtures/lab/jifunze_lab/checks");

describe("lightning roadmap and exercises", () => {
  test("the third roadmap loads", () => {
    expect(listRoadmaps(FIX).map((r) => r.id)).toContain("lightning");
    expect(getRoadmap("lightning", FIX).sections[0].lessons[0].slug).toBe("getting-started");
  });
  test("getExercise reads and validates an exercise file", () => {
    const ex = getExercise("ch02-dina-invoice", FIX);
    expect(ex.node).toBe("dina");
    expect(ex.starter.cli).toContain("addinvoice");
  });
  test("an unknown exercise throws a clear error", () => {
    expect(() => getExercise("nope", FIX)).toThrow(/Exercise not found: nope/);
  });
});

describe("rule 6: exercises", () => {
  const issues = validateContent(BROKEN, { checksDir: CHECKS });
  const rule6 = issues.filter((i) => i.rule === 6);
  test("an <Exercise> with no file is an error", () => {
    expect(rule6.some((i) => i.level === "error" && /"nope"/.test(i.message))).toBe(true);
  });
  test("an exercise whose lesson doesn't match is an error", () => {
    expect(rule6.some((i) => i.level === "error" && /wrong-lesson/.test(i.message) && /lesson/.test(i.message))).toBe(true);
  });
  test("an exercise without a starter for its tab, or without a check, is an error", () => {
    expect(rule6.some((i) => i.level === "error" && /no-check/.test(i.message) && /starter/.test(i.message))).toBe(true);
    expect(rule6.some((i) => i.level === "error" && /no-check/.test(i.message) && /check/.test(i.message))).toBe(true);
  });
  test("a missing model solution is a warning", () => {
    expect(rule6.some((i) => i.level === "warning" && /no-check/.test(i.message) && /solution/.test(i.message))).toBe(true);
  });
  test("clean fixture has no rule 6 errors", () => {
    expect(validateContent(FIX, { checksDir: CHECKS }).filter((i) => i.level === "error")).toEqual([]);
  });
});

describe("lab progress", () => {
  const T = "2026-11-03T10:00:00.000Z";
  test("recordLabPass is idempotent and completes the lesson when all exercises pass", () => {
    let p = recordLabPass(emptyProgress(), "lightning/getting-started", "a", ["a", "b"], T);
    p = recordLabPass(p, "lightning/getting-started", "a", ["a", "b"], T);
    expect(p.lessons["lightning/getting-started"].lab?.passed).toEqual(["a"]);
    expect(p.lessons["lightning/getting-started"].completedAt).toBeUndefined();
    p = recordLabPass(p, "lightning/getting-started", "b", ["a", "b"], T);
    expect(p.lessons["lightning/getting-started"].completedAt).toBe(T);
  });
  test("import keeps lab.passed and round-trips", () => {
    const p = recordLabPass(emptyProgress(), "lightning/getting-started", "a", ["a"], T);
    expect(parseProgressFile(serializeProgress(p, T))).toEqual({ ok: true, progress: p });
  });
  test("a non-array lab.passed is rejected", () => {
    const bad = JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "lightning/x": { lab: { passed: "a" } } } });
    expect(parseProgressFile(bad)).toEqual({ ok: false, error: "invalid-shape" });
  });
  test("files from before the lab still import", () => {
    const old = JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/a": { completedAt: T } } });
    expect(parseProgressFile(old).ok).toBe(true);
  });
});
