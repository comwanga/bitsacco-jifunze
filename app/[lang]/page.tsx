import { pageMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { siteCopy } from "@/lib/site-copy";
import { ContinueLearning } from "@/components/home/ContinueLearning";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PathCard } from "@/components/home/PathCard";
import { BaobabScene } from "@/components/intro/BaobabScene";
import { flatLessons, getGlossary, getLesson, getLibrary, listRoadmaps } from "@/lib/content/load";
import { t, type Lang } from "@/lib/i18n";
import { IntroReplay } from "@/components/intro/IntroReplay";
import { introScript } from "@/lib/intro/shouldPlay";
import { pathOrder } from "@/lib/content/navigation";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  return pageMetadata(lang, "", t(lang, "siteName"), t(lang, "heroLead"));
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const paths = listRoadmaps().map((r) => ({
    r,
    lessons: flatLessons(r).map((slug) => {
      const fm = getLesson(r.id, slug, lang).frontmatter;
      return { slug, title: fm.title, minutes: fm.minutes, level: fm.level };
    }),
  }));
  const order = paths.map(({ r }) => pathOrder(r));
  const titles = Object.fromEntries(paths.flatMap(({ r, lessons }) => lessons.map((l) => [`${r.id}/${l.slug}`, l.title])));
  const pathTitles = Object.fromEntries(paths.map(({ r }) => [r.id, r.title[lang]]));
  const minutes = Object.fromEntries(paths.flatMap(({ r, lessons }) => lessons.map((l) => [`${r.id}/${l.slug}`, l.minutes])));

  return (
    <>
      {/* One dark backdrop under the three earth sections, so their fractional-pixel edges never show the page through. */}
      <div className="bg-earth">
        <IntroReplay>
          <script dangerouslySetInnerHTML={{ __html: introScript() }} />
          <div className="h-[clamp(300px,46svh,560px)] bg-night md:h-[clamp(400px,62svh,640px)]">
            <BaobabScene lang={lang} />
          </div>
          {/* The copy rises into the dark ground of the scene, so the first actions sit on the first screen. */}
          <div className="hero-copy mx-auto -mt-14 max-w-6xl px-4 pb-14 text-[#fbf1e1] sm:px-6 md:-mt-28">
            <h1 className="text-[2.6rem] leading-[1.05] font-extrabold tracking-tight sm:text-6xl">{t(lang, "heroTitle")}</h1>
            <p className="mt-2 text-xl font-semibold text-dawn sm:text-2xl">{t(lang, "heroSubtitle")}</p>
            <p className="mt-4 max-w-xl text-lg text-[#e3d5c5]">{t(lang, "heroLead")}</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                href="#njia"
                className="inline-flex rounded-full bg-sun-deep px-6 py-3 text-base font-bold text-white shadow-[0_4px_18px_rgba(255,88,0,.35)] hover:bg-[#b83c00]"
              >
                {t(lang, "startLearning")}
              </a>
              <Link prefetch={false} href={`/${lang}/learn/`} className="font-semibold text-dawn underline-offset-4 hover:underline">
                {siteCopy[lang].heroBrowse}
              </Link>
            </div>
            <ContinueLearning lang={lang} paths={order} titles={titles} pathTitles={pathTitles} minutes={minutes} />
          </div>
        </IntroReplay>

        <section id="njia" className="bg-earth pb-14 text-[#f3e9dc]" aria-labelledby="njia-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
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

        <section className="bg-earth pb-12 text-[#f3e9dc]" aria-labelledby="labs-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:flex-row md:items-center md:justify-between md:gap-10 md:p-8">
              <div>
                <h2 id="labs-title" className="text-xl font-bold text-white sm:text-2xl">
                  {t(lang, "labsTitle")}
                </h2>
                <p className="mt-2 max-w-2xl text-[#d9cbbb]">{t(lang, "labsBody")}</p>
              </div>
              <Link
                href={`/${lang}/lightning/`}
                className="inline-flex shrink-0 self-start rounded-full border border-dawn/60 px-5 py-2.5 font-semibold text-dawn hover:bg-dawn hover:text-earth md:self-center"
              >
                {t(lang, "labsCta")}
              </Link>
            </div>
          </div>
        </section>
      </div>

      <HowItWorks lang={lang} libraryCount={getLibrary().length} glossaryCount={getGlossary().length} />
    </>
  );
}
