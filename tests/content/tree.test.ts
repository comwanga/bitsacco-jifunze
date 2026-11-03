import { expect, test } from "vitest";
import { buildTree } from "../../lib/content/tree.ts";
import { flatLessons, listRoadmaps } from "../../lib/content/load.ts";

test("trees preserve book order and translated titles with all prerequisites", () => {
  for (const lang of ["sw", "en"] as const) for (const r of listRoadmaps()) {
    const tree = buildTree(lang, r.id);
    const lessons = tree.sections.flatMap((s) => s.lessons);
    expect(lessons.map((l) => l.slug)).toEqual(flatLessons(r));
    expect(new Set(lessons.map((l) => l.slug)).size).toBe(lessons.length);
    expect(lessons.every((l) => l.title && l.prerequisites.every((p) => p.title && lessons.some((x) => x.slug === p.slug)))).toBe(true);
  }
  const capstone = buildTree("en", "builders").sections.flatMap((s) => s.lessons).find((l) => l.slug === "ship-a-tool")!;
  expect(capstone.prerequisites.map((p) => p.slug)).toEqual(["bitsacco-mini-app", "contributing-oss"]);
  expect(() => buildTree("en", "unknown")).toThrow(/Unknown roadmap/);
});
