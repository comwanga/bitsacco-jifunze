import type { Metadata } from "next";
import { GlossaryList } from "@/components/glossary/GlossaryList";
import { getGlossary } from "@/lib/content/load";
import { t, type Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return { title: t(lang, "glossaryTitle"), description: t(lang, "glossaryLead") };
}

export default async function GlossaryPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const other = lang === "sw" ? "en" : "sw";
  const rows = getGlossary()
    .map((g) => ({ id: g.id, term: g[lang], other: g[other], definition: g.definition[lang] }))
    .sort((a, b) => a.term.localeCompare(b.term, lang));
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{t(lang, "glossaryTitle")}</h1>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{t(lang, "glossaryLead")}</p>
      <GlossaryList lang={lang} rows={rows} />
    </div>
  );
}
