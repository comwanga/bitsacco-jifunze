import { expect, test } from "vitest";
import { siteStats } from "../../lib/content/site-stats.ts";

test("counts come from the community finance path's content only", () => {
  // 24 lessons, 438 minutes. Builder and Lightning lessons are not counted.
  expect(siteStats("en", "savers")).toEqual({ lessons: 24, languages: 2, hours: 7, glossaryTerms: 57 });
  expect(siteStats("sw", "savers")).toEqual(siteStats("en", "savers"));
});
