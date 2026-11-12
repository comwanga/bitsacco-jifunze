import { expect, test } from "vitest";
import { emptyProgress, mergeProgress, recordQuiz, type LessonProgress, type Progress } from "../../lib/progress/model.ts";

// Property checks for the progress merge. Documents are generated from a fixed seed, with small pools of
// timestamps and scores so that ties (the hard cases) occur often.

function generator(seed: number) {
  let s = seed;
  const rnd = (n: number): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
  const times = Array.from({ length: 5 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i, 8, i, 0, i * 7)).toISOString());
  const keys = ["savers/a", "savers/b", "builders/c", "lightning/d"];
  const labs = ["e1", "e2", "e3", "e4"];
  return (): Progress => {
    const p = emptyProgress();
    for (const key of keys) {
      if (rnd(4) === 0) continue;
      const l: LessonProgress = {};
      if (rnd(2)) l.completedAt = times[rnd(5)];
      if (rnd(2)) l.reflectedAt = times[rnd(5)];
      if (rnd(3)) {
        const total = rnd(5);
        l.quiz = { correct: total ? rnd(total + 1) : 0, total, at: times[rnd(5)]! };
      }
      if (rnd(2)) l.lab = { passed: labs.filter(() => rnd(2)) };
      p.lessons[key] = l;
    }
    return p;
  };
}

/** Lab passes are a set: their order carries no meaning, so documents are compared with them sorted. */
const canonical = (p: Progress) =>
  JSON.stringify(Object.keys(p.lessons).sort().map((k) => {
    const l = p.lessons[k]!;
    return [k, l.completedAt ?? null, l.reflectedAt ?? null, l.quiz ? [l.quiz.correct, l.quiz.total, l.quiz.at] : null, [...new Set(l.lab?.passed ?? [])].sort()];
  }));

const CASES = 3000;

test("merge is commutative: the order two copies are combined in never changes the result", () => {
  const next = generator(1);
  let quizTies = 0;
  for (let i = 0; i < CASES; i++) {
    const a = next(), b = next();
    for (const k of Object.keys(a.lessons)) {
      const qa = a.lessons[k]!.quiz, qb = b.lessons[k]?.quiz;
      if (qa && qb && qa.at === qb.at && qa.total !== qb.total && qa.correct * (qb.total || 1) === qb.correct * (qa.total || 1)) quizTies++;
    }
    expect(canonical(mergeProgress(a, b))).toBe(canonical(mergeProgress(b, a)));
  }
  expect(quizTies).toBeGreaterThan(20); // the tie-break was really exercised
});

test("merge is associative: three copies combine to the same result however they are grouped", () => {
  const next = generator(2);
  for (let i = 0; i < CASES; i++) {
    const a = next(), b = next(), c = next();
    expect(canonical(mergeProgress(mergeProgress(a, b), c))).toBe(canonical(mergeProgress(a, mergeProgress(b, c))));
  }
});

test("merge is idempotent: combining a copy with itself, or again with a result, changes nothing", () => {
  const next = generator(3);
  for (let i = 0; i < CASES; i++) {
    const a = next(), b = next();
    expect(canonical(mergeProgress(a, a))).toBe(canonical(a));
    const ab = mergeProgress(a, b);
    expect(canonical(mergeProgress(ab, a))).toBe(canonical(ab));
    expect(canonical(mergeProgress(ab, b))).toBe(canonical(ab));
    expect(canonical(mergeProgress(ab, ab))).toBe(canonical(ab));
  }
});

test("merge only adds: nothing either copy holds is ever lost", () => {
  const next = generator(4);
  for (let i = 0; i < CASES; i++) {
    const a = next(), b = next();
    const m = mergeProgress(a, b);
    for (const source of [a, b]) {
      for (const [k, l] of Object.entries(source.lessons)) {
        const got = m.lessons[k]!;
        if (l.completedAt) expect(got.completedAt! <= l.completedAt).toBe(true);
        if (l.reflectedAt) expect(got.reflectedAt! <= l.reflectedAt).toBe(true);
        if (l.quiz) {
          const ratio = (q: { correct: number; total: number }) => (q.total > 0 ? q.correct / q.total : 0);
          expect(ratio(got.quiz!)).toBeGreaterThanOrEqual(ratio(l.quiz));
        }
        for (const id of l.lab?.passed ?? []) expect(got.lab!.passed).toContain(id);
      }
    }
  }
});

test("equal ratio at the same instant: the attempt with more questions wins, from either side", () => {
  const at = "2026-11-01T08:00:00.000Z";
  const doc = (correct: number, total: number): Progress => ({ ...emptyProgress(), lessons: { "savers/a": { quiz: { correct, total, at } } } });
  for (const [small, large] of [[doc(1, 2), doc(2, 4)], [doc(0, 0), doc(0, 3)], [doc(3, 3), doc(5, 5)]] as const) {
    expect(mergeProgress(small, large).lessons["savers/a"]!.quiz).toEqual(large.lessons["savers/a"]!.quiz);
    expect(mergeProgress(large, small).lessons["savers/a"]!.quiz).toEqual(large.lessons["savers/a"]!.quiz);
  }
  // Recording an attempt uses the same rule.
  const recorded = recordQuiz(doc(1, 2), "savers/a", 2, 4, at);
  expect(recorded.lessons["savers/a"]!.quiz).toEqual({ correct: 2, total: 4, at });
  // The earlier rules still come first: a better ratio, then the earlier attempt.
  const later = { ...emptyProgress(), lessons: { "savers/a": { quiz: { correct: 4, total: 8, at: "2026-11-02T08:00:00.000Z" } } } };
  expect(mergeProgress(doc(1, 2), later).lessons["savers/a"]!.quiz).toEqual({ correct: 1, total: 2, at });
  expect(mergeProgress(later, doc(1, 2)).lessons["savers/a"]!.quiz).toEqual({ correct: 1, total: 2, at });
});
