import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { LANGS, type Lang } from "../i18n.ts";
import { CONTENT_ROOT } from "./load.ts";
import {
  BlogCategoriesSchema,
  BlogFrontmatterSchema,
  BlogRegistrySchema,
  type BlogCategory,
  type BlogEntry,
  type BlogFrontmatter,
} from "./schemas.ts";

export const BLOG_ROOT_DIR = "blog";

export type BlogPost = BlogEntry & { langs: Lang[] };
export type LoadedBlogPost = {
  entry: BlogEntry;
  lang: Lang;
  servedLang: Lang;
  isFallback: boolean;
  frontmatter: BlogFrontmatter;
  body: string;
  minutes: number;
};

export function blogPostFile(root: string, lang: Lang, slug: string): string {
  return path.join(root, BLOG_ROOT_DIR, lang, `${slug}.mdx`);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** All posts, newest first. A missing content/blog directory means no posts yet. */
export function listBlogPosts(root: string = CONTENT_ROOT): BlogPost[] {
  const file = path.join(root, BLOG_ROOT_DIR, "posts.json");
  if (!fs.existsSync(file)) return [];
  return BlogRegistrySchema.parse(readJson(file))
    .map((entry) => ({ ...entry, langs: LANGS.filter((l) => fs.existsSync(blogPostFile(root, l, entry.slug))) }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}

export function getBlogCategories(root: string = CONTENT_ROOT): BlogCategory[] {
  const file = path.join(root, BLOG_ROOT_DIR, "categories.json");
  return fs.existsSync(file) ? BlogCategoriesSchema.parse(readJson(file)) : [];
}

/** The post in the page language, or in its own language when it was written in only one. */
export function getBlogPost(slug: string, lang: Lang, root: string = CONTENT_ROOT): LoadedBlogPost {
  const entry = listBlogPosts(root).find((p) => p.slug === slug);
  if (!entry) throw new Error(`Blog post not found: ${slug}`);
  for (const served of lang === "sw" ? (["sw", "en"] as const) : (["en", "sw"] as const)) {
    const file = blogPostFile(root, served, slug);
    if (!fs.existsSync(file)) continue;
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const { langs: _langs, ...registry } = entry;
    return {
      entry: registry, lang, servedLang: served, isFallback: served !== lang,
      frontmatter: BlogFrontmatterSchema.parse(data), body: content, minutes: readingMinutes(content),
    };
  }
  throw new Error(`Blog post has no language file: ${slug}`);
}

export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** The newest featured post leads (or the newest post); the rest follow, without repeating it. */
export function blogIndex(posts: BlogPost[]): { lead: BlogPost | null; recent: BlogPost[] } {
  const lead = posts.find((p) => p.featured) ?? posts[0] ?? null;
  return { lead, recent: posts.filter((p) => p !== lead) };
}

/** Same category first, then the newest others; never the post itself. Posts are newest first. */
export function relatedPosts(slug: string, posts: BlogPost[], limit = 3): BlogPost[] {
  const self = posts.find((p) => p.slug === slug);
  const others = posts.filter((p) => p.slug !== slug);
  const same = others.filter((p) => p.category === self?.category);
  return [...same, ...others.filter((p) => !same.includes(p))].slice(0, limit);
}

const DATE_FORMAT: Record<Lang, Intl.DateTimeFormat> = {
  sw: new Intl.DateTimeFormat("sw", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
};

/** A YYYY-MM-DD calendar date, formatted the same in every timezone. */
export function formatBlogDate(iso: string, lang: Lang): string {
  return DATE_FORMAT[lang].format(new Date(`${iso}T00:00:00Z`));
}
