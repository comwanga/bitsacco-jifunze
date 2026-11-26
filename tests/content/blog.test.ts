import { afterEach, expect, test } from "vitest";
import { blogIndex, formatBlogDate, getBlogPost, listBlogPosts, readingMinutes, relatedPosts } from "../../lib/content/blog.ts";

const root = "tests/fixtures/content";

test("posts are listed newest first with the languages that have a file", () => {
  expect(listBlogPosts(root).map((p) => [p.slug, p.langs])).toEqual([
    ["swahili-featured", ["sw"]],
    ["both", ["sw", "en"]],
    ["english-only", ["en"]],
  ]);
});

test("a post missing in the page language falls back to its own language", () => {
  const en = getBlogPost("english-only", "sw", root);
  expect(en.servedLang).toBe("en");
  expect(en.isFallback).toBe(true);
  expect(en.frontmatter.title).toBe("An English-only post");
  expect(getBlogPost("both", "sw", root).isFallback).toBe(false);
  expect(getBlogPost("both", "sw", root).frontmatter.title).toBe("Makala ya lugha zote mbili");
  expect(() => getBlogPost("missing", "sw", root)).toThrow();
});

test("the newest featured post leads and is not repeated in the recent list", () => {
  const posts = listBlogPosts(root);
  const { lead, recent } = blogIndex(posts);
  expect(lead?.slug).toBe("swahili-featured");
  expect(recent.map((p) => p.slug)).toEqual(["both", "english-only"]);
  const unfeatured = blogIndex(posts.map(({ featured: _f, ...rest }) => rest as typeof rest & { featured?: boolean }));
  expect(unfeatured.lead?.slug).toBe("swahili-featured"); // newest post
  expect(blogIndex([]).lead).toBeNull();
});

test("reading time is words divided by 200, rounded up, at least one minute", () => {
  expect(readingMinutes("word ".repeat(401))).toBe(3);
  expect(readingMinutes("")).toBe(1);
});

test("related posts prefer the same category, never the post itself, at most three", () => {
  const related = relatedPosts("both", listBlogPosts(root)).map((p) => p.slug);
  expect(related[0]).toBe("english-only");
  expect(related).not.toContain("both");
  expect(related.length).toBeLessThanOrEqual(3);
  expect(related).toEqual(["english-only", "swahili-featured"]);
});

const tz = process.env.TZ;
afterEach(() => { process.env.TZ = tz; });

test("dates are calendar dates in both languages, whatever the timezone", () => {
  for (const zone of [undefined, "America/Los_Angeles", "Pacific/Kiritimati"]) {
    if (zone) process.env.TZ = zone;
    expect(formatBlogDate("2026-11-26", "en")).toBe("26 November 2026");
    expect(formatBlogDate("2026-11-26", "sw")).toBe("26 Novemba 2026");
    expect(formatBlogDate("2026-01-01", "sw")).toBe("1 Januari 2026");
  }
});
