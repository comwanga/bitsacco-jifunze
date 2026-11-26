import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { CatalogList } from "../../components/catalog/CatalogList.tsx";
import { PathTree } from "../../components/roadmap/PathTree.tsx";
import { buildTree } from "../../lib/content/tree.ts";
import { buildCatalog, filterCatalog } from "../../lib/content/catalog.ts";

test("catalogue follows book order and identifies quizzes and exercises", () => {
  const entries = buildCatalog("sw");
  expect(entries).toHaveLength(49);
  expect(entries[0]).toMatchObject({ roadmap: "savers", slug: "money-and-bitcoin", n: 1 });
  expect(entries.find((e) => e.slug === "routing-htlcs")?.types).toEqual(["reading", "quiz", "lab"]);
  expect(entries.find((e) => e.roadmap === "lightning" && e.slug === "introduction")?.types).not.toContain("lab");
  expect(buildCatalog("en")).toHaveLength(49);
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

test("a lesson shown in the other language says so with a lang attribute", () => {
  const entries = buildCatalog("sw", "tests/fixtures/content");
  expect(entries.find((e) => e.slug === "beta")?.contentLang).toBe("en"); // no Kiswahili file in the fixture
  expect(entries.find((e) => e.slug === "alpha")?.contentLang).toBe("sw");
  const list = renderToStaticMarkup(createElement(CatalogList, { lang: "sw", entries, defaultPath: "savers" }));
  expect(list).toMatch(/data-catalog-entry="savers\/beta"[^>]*>(?:(?!data-catalog-entry)[\s\S])*?<h2[^>]*lang="en"/);
  expect(list).not.toMatch(/data-catalog-entry="savers\/alpha"[^>]*>(?:(?!data-catalog-entry)[\s\S])*?lang="en"/);
  const tree = renderToStaticMarkup(createElement(PathTree, { tree: buildTree("sw", "savers", "tests/fixtures/content"), lang: "sw" }));
  expect(tree).toMatch(/data-tree-lesson="beta"[^>]*>(?:(?!data-tree-lesson)[\s\S])*?<h3[^>]*lang="en"/);
});

test("the catalogue opens on the community finance path and links to the other paths", () => {
  const entries = buildCatalog("en");
  const list = renderToStaticMarkup(createElement(CatalogList, { lang: "en", entries, defaultPath: "savers" }));
  const rendered = [...list.matchAll(/data-catalog-entry="([^"]+)"/g)].map((m) => m[1]);
  expect(rendered).toHaveLength(entries.filter((e) => e.roadmap === "savers").length);
  expect(rendered.every((key) => key.startsWith("savers/"))).toBe(true);
  expect(list.replace(/<!-- -->/g, "")).toContain(`: 24 / ${entries.length}`);
  // next/link drops the trailing slash outside a Next build; e2e/catalog.spec.ts checks the built links.
  expect(list).toMatch(/data-other-paths[\s\S]*href="\/en\/builders\/?"[\s\S]*href="\/en\/lightning\/?"/);
  expect(list).not.toContain("Clear filters"); // the default view is not a filter to clear
});
