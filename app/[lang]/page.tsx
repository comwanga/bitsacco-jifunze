import Link from "next/link";
import { ContinueLearning } from "@/components/home/ContinueLearning";
import { PathCard } from "@/components/home/PathCard";
import { BaobabScene } from "@/components/intro/BaobabScene";
import { flatLessons, getLesson, listRoadmaps } from "@/lib/content/load";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { introScript } from "@/lib/intro/shouldPlay";

const LOOP: [DictKey, DictKey][] = [
  ["loop1Title", "loop1Body"],
  ["loop2Title", "loop2Body"],
  ["loop3Title", "loop3Body"],
  ["loop4Title", "loop4Body"],
];

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const paths = listRoadmaps().map((r) => ({
    r,
    lessons: flatLessons(r).map((slug) => {
      const fm = getLesson(r.id, slug, lang).frontmatter;
      return { slug, title: fm.title, minutes: fm.minutes, level: fm.level };
    }),
  }));
  const order = paths.map(({ r, lessons }) => ({ id: r.id, slugs: lessons.map((l) => l.slug) }));
  const titles = Object.fromEntries(paths.flatMap(({ r, lessons }) => lessons.map((l) => [`${r.id}/${l.slug}`, l.title])));
  const pathTitles = Object.fromEntries(paths.map(({ r }) => [r.id, r.title[lang]]));

  return (
    <>
      <section className="bg-earth">
        <script dangerouslySetInnerHTML={{ __html: introScript() }} />
        <div className="h-[clamp(300px,46svh,560px)] bg-night md:h-[clamp(400px,62svh,640px)]">
          <BaobabScene lang={lang} />
        </div>
        <div className="hero-copy mx-auto max-w-6xl px-4 pt-2 pb-14 text-[#fbf1e1]">
          <h1 className="text-[2.6rem] leading-[1.05] font-extrabold tracking-tight sm:text-6xl">{t(lang, "heroTitle")}</h1>
          <p className="mt-2 text-xl font-semibold text-dawn sm:text-2xl">{t(lang, "heroSubtitle")}</p>
          <p className="mt-4 max-w-xl text-lg text-[#e3d5c5]">{t(lang, "heroLead")}</p>
          <a
            href="#njia"
            className="mt-7 inline-flex rounded-full bg-sun-deep px-6 py-3 text-base font-bold text-white shadow-[0_4px_18px_rgba(255,88,0,.35)] hover:bg-[#b83c00]"
          >
            {t(lang, "startLearning")}
          </a>
          <ContinueLearning lang={lang} paths={order} titles={titles} pathTitles={pathTitles} />
        </div>
      </section>

      <section id="njia" className="scroll-mt-4 bg-earth pb-16 text-[#f3e9dc]" aria-labelledby="njia-title">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="njia-title" className="sr-only">
            {t(lang, "pathsTitle")}
          </h2>
          <div className="grid gap-12 md:grid-cols-2 md:gap-10 lg:grid-cols-3">
            {paths.map(({ r, lessons }) => (
              <PathCard key={r.id} roadmap={r} lessons={lessons} lang={lang} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-earth px-4 py-12 text-[#f3e9dc]" aria-labelledby="labs-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="labs-title" className="text-xl font-bold text-white sm:text-2xl">
            {t(lang, "labsTitle")}
          </h2>
          <p className="mt-2 max-w-2xl text-[#d9cbbb]">{t(lang, "labsBody")}</p>
          <Link href={`/${lang}/lightning/`} className="mt-4 inline-block font-semibold text-dawn underline-offset-4 hover:underline">
            {t(lang, "labsCta")}
          </Link>
        </div>
      </section>

      <section className="px-4 py-16" aria-labelledby="loop-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="loop-title" className="text-2xl font-bold sm:text-3xl">
            {t(lang, "loopTitle")}
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map(([title, body], i) => (
              <li key={title}>
                <span className="text-4xl font-extrabold text-teal-600 tabular-nums">{i + 1}</span>
                <h3 className="mt-1 text-lg font-bold">{t(lang, title)}</h3>
                <p className="mt-1 text-[var(--muted)]">{t(lang, body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-[var(--line)] px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2">
          <Link href={`/${lang}/library/`} className="group block">
            <h2 className="text-xl font-bold text-teal-700 group-hover:underline dark:text-teal-400">{t(lang, "navLibrary")}</h2>
            <p className="mt-1 text-[var(--muted)]">{t(lang, "libraryCta")}</p>
          </Link>
          <Link href={`/${lang}/glossary/`} className="group block">
            <h2 className="text-xl font-bold text-teal-700 group-hover:underline dark:text-teal-400">{t(lang, "navGlossary")}</h2>
            <p className="mt-1 text-[var(--muted)]">{t(lang, "glossaryCta")}</p>
          </Link>
        </div>
      </section>
    </>
  );
}
