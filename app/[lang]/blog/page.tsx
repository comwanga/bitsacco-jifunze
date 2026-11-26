import type { Metadata } from "next";
import { BlogList } from "@/components/blog/BlogList";
import { blogCards, blogIndex, getBlogCategories, listBlogPosts } from "@/lib/content/blog";
import { t, type Lang } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-metadata";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMetadata(lang, "blog/", t(lang, "blogTitle"), t(lang, "blogLead"));
}

export default async function BlogIndexPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const cards = blogCards(lang);
  const { lead } = blogIndex(listBlogPosts());
  return (
    <>
      <section className="bg-[linear-gradient(160deg,var(--color-night)_0%,#0d3b4a_55%,var(--color-brand)_140%)] text-white">
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-16">
          <h1 className="max-w-3xl text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">{t(lang, "blogTitle")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#d6e2e6]">{t(lang, "blogLead")}</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6">
        {cards.length === 0 ? (
          <p className="text-lg text-[var(--muted)]">{t(lang, "blogEmpty")}</p>
        ) : (
          <BlogList lang={lang} cards={cards} categories={getBlogCategories()} leadSlug={lead?.slug ?? null} />
        )}
      </div>
    </>
  );
}
