import type { Metadata } from "next";
import { CachedLessons } from "@/components/offline/CachedLessons";
import { flatLessons, getLesson, listRoadmaps } from "@/lib/content/load";
import { LANGS, t, type Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return { title: t(lang, "offlineTitle"), robots: { index: false } };
}

export default async function OfflinePage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const titles: Record<string, string> = {};
  for (const r of listRoadmaps()) {
    for (const slug of flatLessons(r)) {
      for (const l of LANGS) titles[`/${l}/${r.id}/${slug}/`] = getLesson(r.id, slug, l).frontmatter.title;
    }
  }
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{t(lang, "offlineTitle")}</h1>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{t(lang, "offlineBody")}</p>
      <CachedLessons lang={lang} titles={titles} />
    </div>
  );
}
