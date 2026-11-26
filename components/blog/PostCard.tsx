import { t, type Lang } from "@/lib/i18n";
import { blogText } from "@/lib/blog/copy";
import type { BlogCard } from "@/lib/content/blog";

/** One post in a listing. `lead` is the large featured card at the top of the index. */
export function PostCard({ card, lang, lead = false }: { card: BlogCard; lang: Lang; lead?: boolean }) {
  const contentLang = card.isFallback ? card.servedLang : undefined;
  const href = `/${lang}/blog/${card.slug}/`;
  return (
    <article
      data-blog-card={card.slug}
      data-category={card.category}
      className={`overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg)] ${lead && card.image ? "md:grid md:grid-cols-[1.3fr_1fr]" : ""}`}
    >
      <div className={lead ? "p-6 sm:p-8" : "p-5"}>
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <span className="rounded-full bg-dawn/25 px-2.5 py-0.5 font-semibold text-[#7a4b06] dark:text-dawn">{card.categoryTitle}</span>
          <span>{card.date}</span>
          <span aria-hidden="true">·</span>
          <span>
            {card.minutes} {t(lang, "minutes")}
          </span>
          {card.isFallback && <span className="rounded-full border border-[var(--line)] px-2 py-0.5">{blogText(lang, "blogOtherLang")}</span>}
        </p>
        <h3 lang={contentLang} className={`mt-3 font-extrabold tracking-tight ${lead ? "text-2xl sm:text-3xl" : "text-xl"}`}>
          <a href={href} className="underline decoration-teal-600/40 underline-offset-4 hover:text-teal-700 dark:hover:text-teal-400">
            {card.title}
          </a>
        </h3>
        <p lang={contentLang} className="mt-2 text-[var(--muted)]">
          {card.description}
        </p>
      </div>
      {card.image && (
        // eslint-disable-next-line @next/next/no-img-element -- static export serves the file as-is
        <img src={card.image} alt={card.imageAlt ?? ""} loading="lazy" className={`w-full object-cover ${lead ? "h-full max-h-80" : "max-h-48"}`} />
      )}
    </article>
  );
}
