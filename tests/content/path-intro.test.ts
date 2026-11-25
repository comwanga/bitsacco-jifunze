import { expect, test } from "vitest";
import { RoadmapSchema } from "../../lib/content/schemas.ts";
import { listRoadmaps } from "../../lib/content/load.ts";
import { pathIntro } from "../../lib/content/path-intro.ts";

const base = {
  id: "savers",
  title: { sw: "a", en: "a" },
  tagline: { sw: "a", en: "a" },
  description: { sw: "a", en: "a" },
  sections: [{ id: "s", title: { sw: "a", en: "a" }, lessons: [{ slug: "x" }] }],
};
const L = (s: string) => ({ sw: s, en: s });

test("intro fields are optional", () => expect(RoadmapSchema.safeParse(base).success).toBe(true));

test("intro needs 3 to 5 outcomes", () => {
  expect(RoadmapSchema.safeParse({ ...base, outcomes: [L("a"), L("b")], format: L("f"), audience: L("w") }).success).toBe(false);
  expect(RoadmapSchema.safeParse({ ...base, outcomes: [L("a"), L("b"), L("c")], format: L("f"), audience: L("w") }).success).toBe(true);
  expect(
    RoadmapSchema.safeParse({ ...base, outcomes: ["a", "b", "c", "d", "e", "f"].map(L), format: L("f"), audience: L("w") }).success,
  ).toBe(false);
});

test("an outcome without Kiswahili is rejected", () => {
  expect(RoadmapSchema.safeParse({ ...base, outcomes: [L("a"), L("b"), { en: "c" }], format: L("f"), audience: L("w") }).success).toBe(false);
});

test("partial intro is rejected", () => expect(RoadmapSchema.safeParse({ ...base, format: L("f") }).success).toBe(false));

test("every path has a complete intro in both languages", () => {
  for (const r of listRoadmaps())
    for (const lang of ["sw", "en"] as const) {
      const intro = pathIntro(r, lang);
      expect(intro, `${r.id}/${lang}`).not.toBeNull();
      expect(intro!.outcomes.length).toBeGreaterThanOrEqual(3);
    }
  expect(pathIntro(listRoadmaps()[0], "en")!.audience).toMatch(/^Anyone about to join/);
});
