import { expect, test } from "vitest";
import { siteStats } from "../../lib/content/site-stats.ts";

test("counts come from the content", () => {
  expect(siteStats("en")).toEqual({ lessons: 49, languages: 2, hours: 34, glossaryTerms: 57 });
  expect(siteStats("sw")).toEqual(siteStats("en"));
});
