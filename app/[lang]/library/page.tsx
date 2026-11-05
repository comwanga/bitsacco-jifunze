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
            <p className="mt-1 text-sm text-[var(--muted)]">
              {item.language === "sw" ? "Kiswahili" : "English"}, PDF, {formatBytes(item.sizeBytes)}. {t(lang, "licence")}:{" "}
              {item.licence}.
            </p>
            {/* Plain <a>, not next/link: prefetching a PDF as a route downloads it twice (bitsacco PR #107). */}
            <a
              href={item.url}
              className="mt-4 inline-flex rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800"
              type="application/pdf"
            >
              {t(lang, "download")} ({formatBytes(item.sizeBytes)})
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
