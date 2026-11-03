import Link from "next/link";
import { ProgressTick } from "@/components/roadmap/ProgressTick";
import type { Roadmap } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";

/** Every section and lesson in the path, with the open lesson marked. Server component; ticks hydrate from local progress. */
export function CourseNav({
  roadmap,
  lang,
  current,
  titles,
}: {
  roadmap: Roadmap;
  lang: Lang;
  current: string;
  titles: Record<string, string>;
}) {
  const number = new Map(roadmap.sections.flatMap((s) => s.lessons).map((l, i) => [l.slug, i + 1]));
  return (
    <nav aria-label={t(lang, "courseNav")} className="text-sm">
      <Link href={`/${lang}/${roadmap.id}/`} className="block font-bold hover:underline">
        {roadmap.title[lang]}
      </Link>
      {roadmap.sections.map((section) => (
        <div key={section.id} className="mt-4">
          <p className="text-xs font-semibold text-[var(--muted)]">{section.title[lang]}</p>
          <ol className="mt-1.5 space-y-0.5">
            {section.lessons.map(({ slug }) => {
              const here = slug === current;
              return (
                <li key={slug}>
                  <Link
                    href={`/${lang}/${roadmap.id}/${slug}/`}
                    aria-current={here ? "page" : undefined}
                    className={`flex items-start gap-2 rounded-lg px-2 py-1.5 leading-snug ${
                      here
                        ? "bg-teal-600/10 font-semibold text-[var(--fg)]"
                        : "text-[var(--muted)] hover:bg-[var(--line)]/40 hover:text-[var(--fg)]"
                    }`}
                  >
                    <ProgressTick roadmap={roadmap.id} slug={slug} n={number.get(slug)!} lang={lang} size="sm" />
                    <span className="pt-0.5">{titles[slug]}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );
}
