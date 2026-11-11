import { expect, test } from "vitest";
import { flatLessons, getLesson, getRoadmap } from "../../lib/content/load.ts";

test("every lesson includes open-ended reasoning prompts in both languages", () => {
  for (const id of ["savers", "builders", "lightning"] as const) for (const slug of flatLessons(getRoadmap(id))) {
    const en = getLesson(id, slug, "en").frontmatter.reflection;
    const sw = getLesson(id, slug, "sw").frontmatter.reflection;
    expect(en.length).toBeGreaterThanOrEqual(3);
    expect(en.length).toBe(sw.length);
    expect(new Set(en).size).toBe(en.length);
    expect(new Set(sw).size).toBe(sw.length);
    expect(en.at(-1)).not.toBe(sw.at(-1));
  }
});
