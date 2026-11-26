"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { BlogCard } from "@/lib/content/blog";
import type { BlogCategory } from "@/lib/content/schemas";
import { PostCard } from "./PostCard";

/**
 * Category chips over the post list. Server-rendered with "All" selected, so every post is listed
 * without JavaScript. With "All", the lead post is the large card; a chosen category lists matching posts.
 */
export function BlogList({ lang, cards, categories, leadSlug }: { lang: Lang; cards: BlogCard[]; categories: BlogCategory[]; leadSlug: string | null }) {
  const [category, setCategory] = useState<string | null>(null);
  const present = categories.filter((c) => cards.some((card) => card.category === c.id));
  const lead = category === null ? cards.find((c) => c.slug === leadSlug) : undefined;
  const shown = cards.filter((c) => c !== lead && (category === null || c.category === category));
  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-sm font-semibold ${active ? "border-teal-700 bg-teal-700 text-white" : "border-[var(--line)] hover:border-teal-600"}`;
  return (
    <>
      {present.length > 1 && (
        <div role="group" aria-label={t(lang, "blogFilter")} className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chip(category === null)}>
            {t(lang, "blogAll")}
          </button>
          {present.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)} className={chip(category === c.id)}>
              {c.title[lang]}
            </button>
          ))}
        </div>
      )}
      {lead && (
        <section aria-labelledby="blog-featured" className="mt-8">
          <h2 id="blog-featured" className="sr-only">
            {t(lang, "blogFeatured")}
          </h2>
          <PostCard card={lead} lang={lang} lead />
        </section>
      )}
      {shown.length > 0 && (
        <section aria-labelledby="blog-recent" className="mt-10">
          <h2 id="blog-recent" className="text-xl font-bold">
            {t(lang, "blogRecent")}
          </h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {shown.map((c) => (
              <PostCard key={c.slug} card={c} lang={lang} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
