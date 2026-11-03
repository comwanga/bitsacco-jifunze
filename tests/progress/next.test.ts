import { describe, expect, test } from "vitest";
import { emptyProgress, markComplete, recordQuiz, type LessonKey, type Progress } from "../../lib/progress/model.ts";
import { continueLearning, lastActivity, nextInPath, type PathOrder } from "../../lib/progress/next.ts";

const savers: PathOrder = { id: "savers", slugs: ["money-and-bitcoin", "sats-and-volatility", "wallets-keys"] };
const builders: PathOrder = { id: "builders", slugs: ["why-bitcoin", "keys"] };
const paths = [savers, builders];

const done = (p: Progress, key: LessonKey, at: string) => markComplete(p, key, at);

describe("lastActivity", () => {
  test("is null with no progress", () => {
    expect(lastActivity(emptyProgress())).toBeNull();
  });
  test("takes the latest of completions and quiz attempts", () => {
    let p = done(emptyProgress(), "savers/money-and-bitcoin", "2026-11-01T10:00:00Z");
    p = recordQuiz(p, "builders/keys", 1, 4, "2026-11-02T09:00:00Z");
    expect(lastActivity(p)).toEqual({ key: "builders/keys", at: "2026-11-02T09:00:00Z" });
  });
});

describe("nextInPath", () => {
  test("is the first lesson not yet completed", () => {
    expect(nextInPath(done(emptyProgress(), "savers/money-and-bitcoin", "2026-11-01T10:00:00Z"), savers)).toBe("sats-and-volatility");
  });
  test("is null once the path is done", () => {
    let p = emptyProgress();
    for (const s of savers.slugs) p = done(p, `savers/${s}`, "2026-11-01T10:00:00Z");
    expect(nextInPath(p, savers)).toBeNull();
  });
});

describe("continueLearning", () => {
  test("is null before any activity", () => {
    expect(continueLearning(emptyProgress(), paths)).toBeNull();
  });
  test("after the first savers lesson, continues to the second", () => {
    const p = done(emptyProgress(), "savers/money-and-bitcoin", "2026-11-01T10:00:00Z");
    expect(continueLearning(p, paths)).toEqual({ roadmap: "savers", slug: "sats-and-volatility", reason: "continue" });
  });
  test("a quiz tried without finishing any lesson starts the path", () => {
    const p = recordQuiz(emptyProgress(), "builders/keys", 1, 4, "2026-11-02T09:00:00Z");
    expect(continueLearning(p, paths)).toEqual({ roadmap: "builders", slug: "why-bitcoin", reason: "start" });
  });
  test("when the last path is finished, suggests the next unfinished one", () => {
    let p = emptyProgress();
    for (const s of savers.slugs) p = done(p, `savers/${s}`, "2026-11-01T10:00:00Z");
    expect(continueLearning(p, paths)).toEqual({ roadmap: "builders", slug: "why-bitcoin", reason: "start" });
  });
  test("is null when every path is finished", () => {
    let p = emptyProgress();
    for (const path of paths) for (const s of path.slugs) p = done(p, `${path.id}/${s}`, "2026-11-01T10:00:00Z");
    expect(continueLearning(p, paths)).toBeNull();
  });
  test("ignores progress for lessons no longer in any path", () => {
    const p = done(emptyProgress(), "savers/retired-lesson", "2026-11-03T10:00:00Z");
    expect(continueLearning(p, paths)).toBeNull();
  });
});
