import { describe, expect, test } from "vitest";
import {
  emptyProgress,
  exportFilename,
  markComplete,
  mergeProgress,
  parseProgressFile,
  recordQuiz,
  recordReflection,
  recordLabPass,
  serializeProgress,
} from "../../lib/progress/model.ts";

const T1 = "2026-11-01T10:00:00.000Z";
const T2 = "2026-11-02T10:00:00.000Z";

test("required discussion confirmation round-trips and merges without invalidating legacy completion", () => {
  const old = markComplete(emptyProgress(), "savers/a", T1);
  const reflected = recordReflection(emptyProgress(), "savers/b", T2);
  const both = mergeProgress(old, reflected);
  expect(parseProgressFile(serializeProgress(both, T2))).toEqual({ ok: true, progress: both });
  expect(both.lessons["savers/a"]).toEqual({ completedAt: T1 });
  expect(both.lessons["savers/b"]).toEqual({ reflectedAt: T2 });
  expect(mergeProgress(reflected, recordReflection(emptyProgress(), "savers/b", T1)).lessons["savers/b"].reflectedAt).toBe(T1);
  expect(recordReflection(reflected, "savers/b", T1)).toBe(reflected);
  expect(parseProgressFile(JSON.stringify({ ...old, lessons: { "savers/a": { reflectedAt: 42 } } }))).toEqual({ ok: false, error: "invalid-shape" });
});

test("a required discussion cannot be skipped by passing the last lab exercise", () => {
  const passed = recordLabPass(emptyProgress(), "lightning/a", "exercise", ["exercise"], T1, true);
  expect(passed.lessons["lightning/a"].completedAt).toBeUndefined();
  expect(passed.lessons["lightning/a"].lab?.passed).toEqual(["exercise"]);
  const reflected = recordReflection(passed, "lightning/a", T2);
  expect(recordLabPass(reflected, "lightning/a", "exercise", ["exercise"], T2, true).lessons["lightning/a"].completedAt).toBe(T2);
});

describe("markComplete", () => {
  test("keeps the first completion time", () => {
    const p = markComplete(markComplete(emptyProgress(), "savers/wallets-keys", T1), "savers/wallets-keys", T2);
    expect(p.lessons["savers/wallets-keys"].completedAt).toBe(T1);
  });
  test("does not mutate its input", () => {
    const p0 = emptyProgress();
    markComplete(p0, "savers/a", T1);
    expect(p0.lessons).toEqual({});
  });
});

describe("recordQuiz", () => {
  test("keeps the best score", () => {
    const p = recordQuiz(recordQuiz(emptyProgress(), "savers/a", 2, 4, T1), "savers/a", 1, 4, T2);
    expect(p.lessons["savers/a"].quiz).toEqual({ correct: 2, total: 4, at: T1 });
  });
  test("a better later score replaces the earlier one", () => {
    const p = recordQuiz(recordQuiz(emptyProgress(), "savers/a", 2, 4, T1), "savers/a", 4, 4, T2);
    expect(p.lessons["savers/a"].quiz).toEqual({ correct: 4, total: 4, at: T2 });
  });
});

describe("parseProgressFile", () => {
  test("rejects text that is not JSON", () => {
    expect(parseProgressFile("{")).toEqual({ ok: false, error: "invalid-json" });
  });
  test("rejects files from another app", () => {
    expect(parseProgressFile(JSON.stringify({ app: "other", version: 1, lessons: {} }))).toEqual({ ok: false, error: "wrong-app" });
  });
  test("rejects newer versions", () => {
    expect(parseProgressFile(JSON.stringify({ app: "bitsacco-jifunze", version: 2, lessons: {} }))).toEqual({
      ok: false,
      error: "unsupported-version",
    });
  });
  test("rejects a bad shape", () => {
    expect(parseProgressFile(JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: [] }))).toEqual({
      ok: false,
      error: "invalid-shape",
    });
    expect(
      parseProgressFile(JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/a": { quiz: { correct: "x" } } } })),
    ).toEqual({ ok: false, error: "invalid-shape" });
    expect(parseProgressFile("null")).toEqual({ ok: false, error: "invalid-shape" });
  });
  test("round-trips an exported file", () => {
    const p = recordQuiz(markComplete(emptyProgress(), "builders/x", T1), "builders/x", 3, 4, T2);
    expect(parseProgressFile(serializeProgress(p, T2))).toEqual({ ok: true, progress: p });
  });
});

describe("mergeProgress", () => {
  test("unions lessons, keeping earliest completion and best quiz", () => {
    const a = recordQuiz(markComplete(emptyProgress(), "savers/a", T2), "savers/a", 1, 4, T1);
    const b = recordQuiz(markComplete(markComplete(emptyProgress(), "savers/a", T1), "savers/b", T2), "savers/a", 3, 4, T2);
    const m = mergeProgress(a, b);
    expect(m.lessons["savers/a"]).toEqual({ completedAt: T1, quiz: { correct: 3, total: 4, at: T2 } });
    expect(m.lessons["savers/b"].completedAt).toBe(T2);
  });
});

test("exportFilename uses the date", () => {
  expect(exportFilename(T2)).toBe("jifunze-maendeleo-2026-11-02.json");
});
