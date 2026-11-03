import Link from "next/link";
import { siteCopy } from "@/lib/site-copy";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { GlossaryIcon, LearnIcon, LibraryIcon, PractiseIcon, ShareIcon, UseIcon } from "./HomeIcons";
import "./home.css";

const STEPS: { title: DictKey; body: DictKey; Icon: typeof LearnIcon }[] = [
  { title: "loop1Title", body: "loop1Body", Icon: LearnIcon },
  { title: "loop2Title", body: "loop2Body", Icon: PractiseIcon },
  { title: "loop3Title", body: "loop3Body", Icon: UseIcon },
  { title: "loop4Title", body: "loop4Body", Icon: ShareIcon },
];

/**
 * The lower home page: a soft horizon out of the dark earth, the four-step learning journey,
 * then the library and glossary as destinations.
 */
export function HowItWorks({ lang, libraryCount, glossaryCount }: { lang: Lang; libraryCount: number; glossaryCount: number }) {
  const c = siteCopy[lang];
  const resources = [
    { id: "library", href: `/${lang}/library/`, title: t(lang, "navLibrary"), body: t(lang, "libraryCta"), count: `${libraryCount} ${c.libraryCount}`, action: c.libraryAction, Icon: LibraryIcon },
    { id: "glossary", href: `/${lang}/glossary/`, title: t(lang, "navGlossary"), body: c.glossaryCard, count: `${glossaryCount} ${c.glossaryCount}`, action: c.glossaryAction, Icon: GlossaryIcon },
  ];
  return (
    <div className="bg-[var(--surface-warm)]">
      <svg aria-hidden="true" viewBox="0 0 1200 60" preserveAspectRatio="none" className="block h-10 w-full text-earth md:h-14">
        <path fill="currentColor" d="M0 0h1200v22c-170 22-380 34-600 34S170 44 0 22z" />
      </svg>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 md:pt-14" aria-labelledby="loop-title">
        <h2 id="loop-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t(lang, "loopTitle")}
        </h2>
        <ol data-loop className="mt-10 grid gap-8 lg:grid-cols-4 lg:gap-6">
          {STEPS.map(({ title, body, Icon }, i) => (
            <li key={title} className="loop-step relative flex gap-4 lg:block">
              <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-teal-700/20 bg-[var(--card)] text-teal-700 shadow-[0_2px_10px_-4px_rgb(15_118_110/0.35)] dark:text-teal-300">
                <Icon className="h-7 w-7" />
                <span aria-hidden="true" className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-sun-deep text-xs font-bold text-white tabular-nums">
                  {i + 1}
                </span>
              </span>
              <div className="pt-1 lg:mt-5 lg:pt-0">
                <h3 className="text-lg font-bold">{t(lang, title)}</h3>
                <p className="mt-1 max-w-[34ch] text-[var(--muted)]">{t(lang, body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="resources-title">
        <h2 id="resources-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {c.resourcesTitle}
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {resources.map(({ id, href, title, body, count, action, Icon }) => (
            <Link
              key={id}
              data-resource={id}
              href={href}
              prefetch={false}
              className="group flex gap-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 transition-colors hover:border-teal-600/60 motion-reduce:transition-none"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-700/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-bold">{title}</h3>
                <span className="mt-1 block text-[var(--muted)]">{body}</span>
                <span className="mt-3 block text-sm text-[var(--muted)] tabular-nums">{count}</span>
                <span className="mt-4 inline-block font-semibold text-teal-700 underline-offset-4 group-hover:underline dark:text-teal-300">{action}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
