import type { Metadata } from "next";
import { ProgressTransfer } from "@/components/progress/ProgressTransfer";
import { flatLessons, getLesson, listRoadmaps } from "@/lib/content/load";
import { t, type Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return { title: t(lang, "progressTitle") };
}

export default async function ProgressPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const roadmaps = listRoadmaps().map((r) => ({
    id: r.id,
    title: r.title[lang],
    lessons: flatLessons(r).map((slug) => ({ slug, title: getLesson(r.id, slug, lang).frontmatter.title })),
  }));
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{t(lang, "progressTitle")}</h1>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{t(lang, "progressLead")}</p>
      <ProgressTransfer lang={lang} roadmaps={roadmaps} />
    </div>
  );
}
