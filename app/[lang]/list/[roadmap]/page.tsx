import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackLink } from "@/components/FeedbackLink";
import { ProgressTick } from "@/components/roadmap/ProgressTick";
import { PathHeader } from "@/components/roadmap/PathHeader";
import { SectionProgress } from "@/components/roadmap/SectionProgress";
import { buildCatalog } from "@/lib/content/catalog";
import { flatLessons, getLesson, getRoadmap, listRoadmaps } from "@/lib/content/load";
import type { RoadmapId } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";
import { pathOrder } from "@/lib/content/navigation";
import { SpecializationChoices } from "@/components/roadmap/SpecializationChoices";

export const dynamicParams = false;

export function generateStaticParams() {
  return listRoadmaps().map((r) => ({ roadmap: r.id }));
}

type Params = { params: Promise<{ lang: string; roadmap: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, roadmap } = await params;
  const r = getRoadmap(roadmap as RoadmapId);
  return pageMetadata(lang as Lang, `list/${roadmap}/`, r.title[lang as Lang], r.description[lang as Lang]);
}

export default async function RoadmapPage({ params }: Params) {
  const { lang: l, roadmap: rid } = await params;
  const lang = l as Lang;
  const r = getRoadmap(rid as RoadmapId);
  const slugs = flatLessons(r);
  const lessons = new Map(slugs.map((s) => [s, getLesson(r.id, s, lang)]));
  const minutes = [...lessons.values()].reduce((m, x) => m + x.frontmatter.minutes, 0);
  const last = slugs[slugs.length - 1];
  const types = new Map(buildCatalog(lang).filter((e) => e.roadmap === r.id).map((e) => [e.slug, e.types]));

  return (
    <>
      <PathHeader path={{ id: r.id, title: r.title[lang], tagline: r.tagline[lang], description: r.description[lang] }} lang={lang} slugs={slugs} optionalSections={pathOrder(r).optionalSections} minutes={minutes} view="list" />

      <div className="mx-auto max-w-3xl px-4 py-10">
        <SpecializationChoices sections={r.sections.map((s) => ({ ...s, title: s.title[lang], description: s.description?.[lang] }))} lang={lang} prefix="s" />
        {r.sections.map((section) => (
          <section key={section.id} id={`s-${section.id}`} className="mb-10 scroll-mt-24" aria-labelledby={`title-${section.id}`}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 id={`title-${section.id}`} className="text-xl font-bold">
                {section.title[lang]}
              </h2>
              <SectionProgress section={section.id} roadmap={r.id} slugs={section.lessons.map((e) => e.slug)} lang={lang} />
            </div>
            {section.description && <p className="mt-2 text-[var(--muted)]">{section.description[lang]}</p>}
            <details open={!section.optional} className="mt-4">
            <summary className={section.optional ? "cursor-pointer font-semibold text-teal-700 dark:text-teal-400" : "hidden"}>{t(lang, "optionalLessons")}</summary>
            <ol className="mt-4 space-y-2">
              {section.lessons.map((entry) => {
                const n = slugs.indexOf(entry.slug) + 1;
                const lesson = lessons.get(entry.slug)!;
                const fm = lesson.frontmatter;
                return (
                  <li key={entry.slug}>
                    <Link
                      prefetch={false}
                      href={`/${lang}/${r.id}/${entry.slug}/`}
                      className="flex gap-4 rounded-xl px-2 py-3 hover:bg-[var(--line)]/40"
                    >
                      <ProgressTick roadmap={r.id} slug={entry.slug} n={n} lang={lang} />
                      <span className="min-w-0">
                        <span className="block text-[17px] font-semibold leading-snug">{fm.title}</span>
                        <span className="mt-0.5 block text-[15px] text-[var(--muted)]">{fm.description}</span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
                          <span>
                            {fm.minutes} {t(lang, "minutes")}
                          </span>
                          <span>{t(lang, `level_${fm.level}`)}</span>
                          {types.get(entry.slug)!.map((kind) => (
                            <span key={kind} className="rounded-full border border-[var(--line)] px-2">{t(lang, `type_${kind}`)}</span>
                          ))}
                          {lesson.isFallback && (
                            <span className="rounded-full bg-dawn/25 px-2 text-[#7a4b06] dark:text-dawn">
                              {t(lang, "translationComing")}
                            </span>
                          )}
                          {entry.prerequisites?.length ? (
                            <span>
                              {t(lang, "readFirst")}:{" "}
                              {entry.prerequisites.map((p) => lessons.get(p)?.frontmatter.title ?? p).join(", ")}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            </details>
          </section>
        ))}

        <section className="rounded-2xl bg-earth p-6 text-[#f3e9dc]" aria-labelledby="next-title">
          <h2 id="next-title" className="text-xl font-bold text-white">
            {t(lang, "whatsNext")}
          </h2>
          <p className="mt-2 text-[#d9cbbb]">{t(lang, r.id === "savers" ? "whatsNextSavers" : "whatsNextBuilders")}</p>
          <p className="mt-4 flex flex-wrap gap-3">
            {r.id === "builders" && (
              <Link href={`/${lang}/${r.id}/${last}/`} className="rounded-full bg-sun-deep px-5 py-2.5 font-semibold text-white">
                {lessons.get(last)!.frontmatter.title}
              </Link>
            )}
            <Link href={`/${lang}/library/`} className="rounded-full border border-dawn/60 px-5 py-2.5 font-semibold text-dawn">
              {t(lang, "navLibrary")}
            </Link>
          </p>
        </section>
        <FeedbackLink lang={lang} context={{ pathTitle: r.title[lang], pathname: `/${lang}/${r.id}/` }} className="text-teal-700 dark:text-teal-400" />
      </div>
    </>
  );
}
