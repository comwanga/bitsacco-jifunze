import { expect, test } from "vitest";
import { getRoadmap } from "../../lib/content/load.ts";
import { pathOrder, readingSequence } from "../../lib/content/navigation.ts";
import { emptyProgress, markComplete, recordQuiz } from "../../lib/progress/model.ts";
import { continueLearning, nextInPath } from "../../lib/progress/next.ts";

test("introductory completion and each optional specialization have independent reading sequences", () => {
  const roadmap = getRoadmap("savers");
  const core = roadmap.sections.filter((s) => !s.optional).flatMap((s) => s.lessons.map((l) => l.slug));
  expect(core).toEqual(["money-and-bitcoin", "sats-and-volatility", "wallets-keys", "custody-and-fedimint", "lightning-payments", "scams", "saving-together", "next-steps"]);
  expect(readingSequence(roadmap, "next-steps")).toEqual(core);
  const path = pathOrder(roadmap);
  expect(path.optionalSections).toHaveLength(3);
  let progress = emptyProgress();
  for (const slug of core) progress = markComplete(progress, `savers/${slug}`, "2026-11-11T00:00:00Z");
  expect(nextInPath(progress, path)).toBeNull();
  expect(continueLearning(progress, [path, pathOrder(getRoadmap("builders"))])).toBeNull();
  for (const section of roadmap.sections.filter((s) => s.optional)) {
    const sequence = section.lessons.map((l) => l.slug);
    expect(readingSequence(roadmap, sequence[0])).toEqual(sequence);
    const tried = recordQuiz(progress, `savers/${sequence[0]}`, 1, 4, "2026-11-11T01:00:00Z");
    expect(nextInPath(tried, path)).toBe(sequence[0]);
    const started = markComplete(tried, `savers/${sequence[0]}`, "2026-11-11T02:00:00Z");
    expect(nextInPath(started, path)).toBe(sequence[1]);
    let finished = started;
    for (const slug of sequence.slice(1)) finished = markComplete(finished, `savers/${slug}`, "2026-11-11T03:00:00Z");
    expect(nextInPath(finished, path)).toBeNull();
    expect(continueLearning(finished, [path, pathOrder(getRoadmap("builders"))])).toBeNull();
  }
});

test("builder reading and continuation remain unchanged", () => {
  for (const id of ["builders", "lightning"] as const) {
    const roadmap = getRoadmap(id);
    const order = pathOrder(roadmap);
    expect(order.optionalSections).toBeUndefined();
    expect(readingSequence(roadmap, order.slugs.at(-1)!)).toEqual(order.slugs);
    expect(nextInPath(emptyProgress(), order)).toBe(order.slugs[0]);
  }
});
