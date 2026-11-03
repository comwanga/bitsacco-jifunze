import { expect, test } from "vitest";
import { buildCatalog, filterCatalog } from "../../lib/content/catalog.ts";

test("catalogue follows book order and identifies quizzes and exercises", () => {
  const entries = buildCatalog("sw");
  expect(entries).toHaveLength(33);
  expect(entries[0]).toMatchObject({ roadmap: "savers", slug: "money-and-bitcoin", n: 1 });
  expect(entries.find((e) => e.slug === "routing-htlcs")?.types).toEqual(["reading", "quiz", "lab"]);
  expect(entries.find((e) => e.roadmap === "lightning" && e.slug === "introduction")?.types).not.toContain("lab");
  expect(buildCatalog("en")).toHaveLength(33);
});

test("search ignores case and diacritics and combines all filters", () => {
  const entries = buildCatalog("sw");
  expect(filterCatalog(entries, { text: "PÓCHI" }).some((e) => e.slug === "wallets-keys")).toBe(true);
  expect(filterCatalog(entries, { text: "htlc" }).some((e) => e.slug === "routing-htlcs")).toBe(true);
  const labs = filterCatalog(entries, { type: "lab" });
  expect(labs.length).toBeGreaterThan(0);
  expect(labs.every((e) => e.roadmap === "lightning" && e.types.includes("lab"))).toBe(true);
  const entry = labs[0];
  expect(filterCatalog(entries, { text: entry.title, roadmap: entry.roadmap, level: entry.level, type: "lab" })).toContainEqual(entry);
  expect(filterCatalog(entries, { text: "zzzz-no-lesson" })).toEqual([]);
  expect(filterCatalog(entries, {})).toEqual(entries);
  expect(filterCatalog(entries, { text: `  ${entries[0].section}  ` })).toContainEqual(entries[0]);
});
