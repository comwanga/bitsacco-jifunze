import type { Metadata } from "next";
import { CatalogList } from "@/components/catalog/CatalogList";
import { buildCatalog } from "@/lib/content/catalog";
import { t, type Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return { title: t(lang, "catalogTitle"), description: t(lang, "catalogLead") };
}

export default async function LearnPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{t(lang, "catalogTitle")}</h1>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{t(lang, "catalogLead")}</p>
      <CatalogList lang={lang} entries={buildCatalog(lang)} />
    </div>
  );
}
