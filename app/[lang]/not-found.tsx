import Link from "next/link";
import { listRoadmaps } from "@/lib/content/load";
import { LANGS, t } from "@/lib/i18n";
import { siteCopy } from "@/lib/site-copy";

// One static 404 page serves every language, so it shows each main destination in both.
export default function NotFound() {
  const roadmaps = listRoadmaps();
  return (
    <section className="mx-auto max-w-2xl px-4 py-20">
      <h1 className="text-3xl font-bold">Ukurasa haupatikani</h1>
      <p className="mt-1 text-lg text-[var(--muted)]" lang="en">
        Page not found
      </p>
      <p className="mt-6 flex gap-6">
        <Link className="font-semibold text-teal-700 underline dark:text-teal-400" href="/sw/">
          Rudi mwanzo
        </Link>
        <Link className="font-semibold text-teal-700 underline dark:text-teal-400" href="/en/" lang="en">
          Go home
        </Link>
      </p>
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        {LANGS.map((lang) => (
          <nav key={lang} data-not-found-links lang={lang} aria-labelledby={`not-found-next-${lang}`}>
            <h2 id={`not-found-next-${lang}`} className="text-lg font-bold">
              {siteCopy[lang].notFoundNext}
            </h2>
            <ul className="mt-3 space-y-2">
              {[
                ...roadmaps.map((r) => ({ href: `/${lang}/${r.id}/`, label: r.title[lang] })),
                { href: `/${lang}/learn/`, label: siteCopy[lang].heroBrowse },
                { href: `/${lang}/glossary/`, label: t(lang, "navGlossary") },
                { href: `/${lang}/library/`, label: t(lang, "navLibrary") },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link prefetch={false} className="font-semibold text-teal-700 underline underline-offset-4 dark:text-teal-400" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </section>
  );
}
