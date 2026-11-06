import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { getLibrary } from "@/lib/content/load";
import { formatBytes } from "@/lib/format";
import { t, type Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMetadata(lang, "library/", t(lang, "libraryTitle"), t(lang, "libraryLead"));
}

export default async function LibraryPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const items = getLibrary();
  const copy = lang === "sw" ? {
    online: "Soma mtandaoni (mradi rasmi, Kiingereza)",
    read: "Soma PDF hapa",
    pending: "PDF ya Kiswahili inasubiri kuchapishwa rasmi. Upakuaji haupatikani kwa sasa.",
  } : {
    online: "Read online (official project, English)",
    read: "Read PDF here",
    pending: "The Kiswahili PDF awaits official publication. Download is currently unavailable.",
  };
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{t(lang, "libraryTitle")}</h1>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{t(lang, "libraryLead")}</p>
      <ul className="mt-8 space-y-6">
        {items.map((item) => (
          <li key={item.id} id={item.id} className="rounded-2xl border border-[var(--line)] p-5">
            <h2 className="text-xl font-bold" lang={item.language}>
              {item.title[lang]}
            </h2>
            <p className="mt-1 text-[var(--muted)]">
              {t(lang, "by")} {item.author}
              {item.credit && (
                <>
                  , {t(lang, "translatedBy")} {item.credit}
                </>
              )}
            </p>
            {item.note && <p className="mt-2">{item.note[lang]}</p>}
            {item.format === "pending-pdf" ? <p className="mt-4 rounded-xl bg-dawn/20 p-4">{copy.pending}</p> : <>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {item.language === "sw" ? "Kiswahili" : "English"}
                {item.format === "pdf" && item.sizeBytes ? `, PDF, ${formatBytes(item.sizeBytes)}` : ""}. {t(lang, "licence")}: {item.licence}.
              </p>
              {/* Plain <a>, not next/link: prefetching a PDF as a route downloads it twice (bitsacco PR #107). */}
              {item.id === "mastering-bitcoin-en" && <a href={`/${lang}/library/mastering-bitcoin-en/`} className="mr-3 mt-4 inline-flex rounded-full border-2 border-teal-700 px-5 py-2.5 font-semibold text-teal-800 dark:text-teal-200">{copy.read}</a>}
              <a
                href={item.url}
                download={item.url?.startsWith("/books/") ? item.url.split("/").pop() : undefined}
                className="mt-4 inline-flex rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800"
                type={item.format === "pdf" ? "application/pdf" : undefined}
              >
                {item.format === "pdf" && item.sizeBytes ? `${t(lang, "download")} (${formatBytes(item.sizeBytes)})` : copy.online}
              </a>
            </>}
          </li>
        ))}
      </ul>
    </div>
  );
}
