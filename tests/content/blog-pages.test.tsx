import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { BlogList } from "../../components/blog/BlogList.tsx";
import { PostCard } from "../../components/blog/PostCard.tsx";
import { blogCards, getBlogCategories } from "../../lib/content/blog.ts";

const root = "tests/fixtures/content";

test("an English-only post on the Kiswahili index carries a badge and an English lang attribute", () => {
  const card = blogCards("sw", root).find((c) => c.slug === "english-only")!;
  expect(card.servedLang).toBe("en");
  const html = renderToStaticMarkup(<PostCard card={card} lang="sw" />);
  expect(html).toContain("Kwa Kiingereza");
  expect(html).toMatch(/<h3[^>]*lang="en"[^>]*>[\s\S]*An English-only post/);
  expect(html).toContain('href="/sw/blog/english-only/"');
});

test("a post in the page language has no badge or lang override", () => {
  const card = blogCards("sw", root).find((c) => c.slug === "both")!;
  const html = renderToStaticMarkup(<PostCard card={card} lang="sw" />);
  expect(html).not.toContain("Kwa Kiingereza");
  expect(html).toContain("Makala ya lugha zote mbili");
  expect(html).not.toMatch(/<h3[^>]*lang=/);
});

test("without JavaScript the index lists every post, and chips show only categories that have posts", () => {
  const categories = getBlogCategories(root).concat([{ id: "myths", title: { sw: "Kweli au uongo", en: "Myth-busting" } }]);
  const html = renderToStaticMarkup(<BlogList lang="en" cards={blogCards("en", root)} categories={categories} leadSlug="swahili-featured" />);
  for (const slug of ["swahili-featured", "both", "english-only"]) expect(html).toContain(`href="/en/blog/${slug}/"`);
  expect(html).toContain("Explainers");
  expect(html).toContain("Practical guides");
  expect(html).not.toContain("Myth-busting");
  expect(html.match(/data-blog-card/g)).toHaveLength(3);
});
