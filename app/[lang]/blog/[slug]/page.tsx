import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackLink } from "@/components/FeedbackLink";
import { PostCard } from "@/components/blog/PostCard";
import { blogCard, formatBlogDate, getBlogCategories, getBlogPost, listBlogPosts, relatedPosts } from "@/lib/content/blog";
import { getGlossary, getLesson, getRoadmap } from "@/lib/content/load";
import { renderBlogBody } from "@/lib/content/mdx";
import type { RoadmapId } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-metadata";

export const dynamicParams = false;

// The blog has no layout of its own, so [lang] comes from the parent; generate the slug here.
export function generateStaticParams() {
  return listBlogPosts().map((p) => ({ slug: p.slug }));
}

type Params = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, slug } = await params;
  const post = getBlogPost(slug, lang as Lang);
  const base = pageMetadata(lang as Lang, `blog/${slug}/`, post.frontmatter.title, post.frontmatter.description);
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: post.entry.publishedAt,
      modifiedTime: post.entry.updatedAt,
      authors: [post.entry.author],
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { lang: l, slug } = await params;
  const lang = l as Lang;
  const post = getBlogPost(slug, lang);
  const { entry, frontmatter: fm } = post;
  const categories = getBlogCategories();
  const category = categories.find((c) => c.id === entry.category)?.title[lang] ?? entry.category;
  const body = await renderBlogBody(post.body, post.servedLang, getGlossary());
  const lessons = entry.relatedLessons.map((key) => {
    const [roadmap, lessonSlug] = key.split("/") as [RoadmapId, string];
    const lesson = getLesson(roadmap, lessonSlug, lang);
    return { href: `/${lang}/${roadmap}/${lessonSlug}/`, path: getRoadmap(roadmap).title[lang], title: lesson.frontmatter.title, minutes: lesson.frontmatter.minutes };
  });
  const related = relatedPosts(slug, listBlogPosts()).map((p) => blogCard(p, lang, categories));
  const contentLang = post.isFallback ? post.servedLang : undefined;

  return (
    <div className="mx-auto max-w-[72ch] px-4 pt-8 pb-16">
      <p className="text-sm text-[var(--muted)]">
        <Link href={`/${lang}/blog/`} className="underline underline-offset-2 hover:text-[var(--fg)]">
          {t(lang, "blogTitle")}
        </Link>{" "}
        <span aria-hidden="true">/</span> {category}
      </p>
      <article lang={contentLang}>
        <h1 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{fm.title}</h1>
        <p className="mt-3 text-lg text-[var(--muted)]">{fm.description}</p>
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--muted)]" lang={lang}>
          <span>
            {t(lang, "blogBy")} {entry.author}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={entry.publishedAt}>{formatBlogDate(entry.publishedAt, lang)}</time>
          {entry.updatedAt && (
            <span>
              ({t(lang, "blogUpdated")} <time dateTime={entry.updatedAt}>{formatBlogDate(entry.updatedAt, lang)}</time>)
            </span>
          )}
          <span aria-hidden="true">·</span>
          <span>
            {post.minutes} {t(lang, "minutes")}
          </span>
        </p>
        {post.isFallback && (
          <p className="mt-6 rounded-xl bg-dawn/20 p-4 text-[15px]" lang={lang} role="note">
            {t(lang, "blogFallback")}
          </p>
        )}
        {entry.image && (
          // eslint-disable-next-line @next/next/no-img-element -- static export serves the file as-is
          <img src={entry.image} alt={fm.imageAlt ?? ""} className="mt-8 h-auto w-full rounded-2xl border border-[var(--line)]" />
        )}
        <div className="lesson-body mt-8">{body}</div>
      </article>

      <section aria-labelledby="blog-continue" className="mt-12" lang={lang}>
        <h2 id="blog-continue" className="text-2xl font-bold">
          {t(lang, "blogContinue")}
        </h2>
        <ul className="mt-4 grid gap-3">
          {lessons.map((lesson) => (
            <li key={lesson.href}>
              <Link href={lesson.href} data-continue-lesson className="block rounded-xl border border-[var(--line)] p-4 hover:border-teal-600">
                <span className="block text-sm text-[var(--muted)]">{lesson.path}</span>
                <span className="mt-1 block font-bold">{lesson.title}</span>
                <span className="mt-1 block text-sm text-[var(--muted)]">
                  {lesson.minutes} {t(lang, "minutes")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="blog-related" className="mt-12" lang={lang}>
          <h2 id="blog-related" className="text-2xl font-bold">
            {t(lang, "blogRelated")}
          </h2>
          <div className="mt-4 grid gap-4">
            {related.map((card) => (
              <PostCard key={card.slug} card={card} lang={lang} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-10" lang={lang}>
        <FeedbackLink lang={lang} context={{ pathTitle: t(lang, "blogTitle"), lessonTitle: fm.title, pathname: `/${lang}/blog/${slug}/` }} className="text-teal-700 dark:text-teal-400" />
      </div>
    </div>
  );
}
