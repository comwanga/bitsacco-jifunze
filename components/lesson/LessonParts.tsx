import Link from "next/link";
import type { GlossaryTerm, LessonFrontmatter, Resource } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";

export function Objectives({ lang, items }: { lang: Lang; items: string[] }) {
  return (
    <section className="my-8 rounded-2xl bg-teal-50 p-5 text-teal-950 dark:bg-teal-900/25 dark:text-teal-50" aria-labelledby="obj">
      <h2 id="obj" className="text-lg font-bold">
        {t(lang, "objectives")}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
    </section>
  );
}

export function KeyTerms({ lang, terms }: { lang: Lang; terms: GlossaryTerm[] }) {
  if (terms.length === 0) return null;
  const other = lang === "sw" ? "en" : "sw";
  return (
    <section className="my-8" aria-labelledby="terms">
      <h2 id="terms" className="text-lg font-bold">
        {t(lang, "keyTerms")}
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {terms.map((g) => (
          <div key={g.id} className="rounded-xl border border-[var(--line)] p-3">
            <dt>
              <a href={`/${lang}/glossary/#${g.id}`} className="font-semibold hover:underline">
                {g[lang]}
              </a>
              {g[other].toLowerCase() !== g[lang].toLowerCase() && (
                <span className="text-[var(--muted)]" lang={other}>
                  {" "}
                  ({g[other]})
                </span>
              )}
            </dt>
            <dd className="mt-1 text-[15px] text-[var(--muted)]">{g.definition[lang]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Reflection({ lang, prompts }: { lang: Lang; prompts: string[] }) {
  return (
    <section className="my-10" aria-labelledby="reflect">
      <h2 id="reflect" className="text-xl font-bold">
        {t(lang, "reflection")}
      </h2>
      <p className="mt-1 text-[var(--muted)]">{t(lang, "reflectionHint")}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        {prompts.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
    </section>
  );
}

const KIND_ICON: Record<Resource["kind"], string> = {
  article: "📄",
  book: "📚",
  video: "🎬",
  docs: "📘",
  tool: "🛠️",
  pdf: "📕",
  community: "👥",
};

export function Resources({ lang, items }: { lang: Lang; items: Resource[] }) {
  if (items.length === 0) return null;
  return (
    <section className="my-10" aria-labelledby="res">
      <h2 id="res" className="text-xl font-bold">
        {t(lang, "resources")}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((r) => (
          <li key={r.url} className="flex gap-3">
            <span aria-hidden="true">{KIND_ICON[r.kind]}</span>
            <span>
              <a href={r.url} className="font-semibold text-teal-700 underline underline-offset-2 dark:text-teal-400" hrefLang={r.language}>
                {r.title}
              </a>{" "}
              <span className="text-sm text-[var(--muted)]">({r.language === "sw" ? "Kiswahili" : "English"})</span>
              {r.note && <span className="block text-sm text-[var(--muted)]">{r.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SourceCredit({ lang, fm }: { lang: Lang; fm: LessonFrontmatter }) {
  return (
    <p className="mt-10 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
      {fm.source.type === "adapted" ? (
        <>
          {t(lang, "adaptedFrom")}{" "}
          <a className="underline" href={fm.source.url}>
            {fm.source.from}
          </a>
          . {fm.source.credit}. {t(lang, "licence")}: {fm.source.licence}.
        </>
      ) : (
        <>{t(lang, "original")}. {t(lang, "licence")}: CC BY-SA 4.0.</>
      )}
      {fm.lastReviewed && (
        <span className="block">
          {t(lang, "lastReviewed")}: {fm.lastReviewed}
        </span>
      )}
    </p>
  );
}

export function PrevNext({
  lang,
  prev,
  next,
}: {
  lang: Lang;
  prev?: { href: string; title: string };
  next?: { href: string; title: string };
}) {
  return (
    <nav className="mt-8 grid gap-3 sm:grid-cols-2" aria-label={`${t(lang, "prev")} / ${t(lang, "next")}`}>
      {prev ? (
        <Link href={prev.href} className="rounded-xl border border-[var(--line)] p-4 hover:border-teal-600">
          <span className="block text-sm text-[var(--muted)]">{t(lang, "prev")}</span>
          <span className="font-semibold">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="rounded-xl border border-[var(--line)] p-4 text-right hover:border-teal-600">
          <span className="block text-sm text-[var(--muted)]">{t(lang, "next")}</span>
          <span className="font-semibold">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
