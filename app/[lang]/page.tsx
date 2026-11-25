import { pageMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { siteCopy } from "@/lib/site-copy";
import { ContinueLearning } from "@/components/home/ContinueLearning";
import { PathCard } from "@/components/home/PathCard";
import { SavingsCircle } from "@/components/home/SavingsCircle";
import { JoinQuestions } from "@/components/home/JoinQuestions";
import { flatLessons, getLesson, listRoadmaps } from "@/lib/content/load";
import { t, type Lang } from "@/lib/i18n";
import { pathOrder } from "@/lib/content/navigation";
import { siteStats } from "@/lib/content/site-stats";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  return pageMetadata(lang, "", t(lang, "siteName"), siteCopy[lang].heroLead);
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
  const c = siteCopy[lang];
  const stats = siteStats(lang);
  const statItems = [
    c.statsLessons.replace("{n}", String(stats.lessons)),
    c.statsLanguages.replace("{n}", String(stats.languages)),
    c.statsHours.replace("{n}", String(stats.hours)),
    c.statsTerms.replace("{n}", String(stats.glossaryTerms)),
  ];
  const words = c.heroTitle.split(" ");
  const titleLast = words.pop();
  const titleHead = words.join(" ");
  const lead = paths.find(({ r }) => r.id === "savers")!;
  const specializations = lead.r.sections.filter((s) => s.optional).map((s) => ({ id: s.id, title: s.title[lang] }));
  const starts = [
    { href: `/${lang}/savers/saving-together/`, label: c.startJoin },
    { href: `/${lang}/savers/#specializations`, label: c.startMember },
    { href: `/${lang}/savers/money-and-bitcoin/`, label: c.startSolo },
    { href: `/${lang}/savers/group-payments/`, label: c.startMove },
  ];
  const minutes = Object.fromEntries(paths.flatMap(({ r, lessons }) => lessons.map((l) => [`${r.id}/${l.slug}`, l.minutes])));

  return (
    <>
      {/* One dark backdrop under the three earth sections, so their fractional-pixel edges never show the page through. */}
      <div className="bg-earth">
        <section className="hero-band bg-[linear-gradient(160deg,var(--color-night)_0%,#0d3b4a_55%,var(--color-brand)_140%)] pb-9 text-white [clip-path:polygon(0_0,100%_0,100%_calc(100%-1.5rem),0_100%)] sm:pb-16">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-5 sm:px-6 sm:pt-12 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-12">
            <div>
              <h1 className="text-[2.2rem] leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
                {titleHead}{" "}
                <span className="bg-[linear-gradient(transparent_78%,var(--color-sun)_78%,var(--color-sun)_90%,transparent_90%)]">{titleLast}</span>
              </h1>
              <p className="mt-2 text-lg font-semibold text-dawn sm:text-2xl">{c.heroSubtitle}</p>
              <p className="mt-3 max-w-xl text-base text-[#d6e2e6] sm:text-lg">{c.heroLead}</p>
              <ContinueLearning lang={lang} paths={order} titles={titles} pathTitles={pathTitles} minutes={minutes} localNote={c.progressLocal} manageLabel={c.progressManage} />
            </div>
            <div>
              <SavingsCircle lang={lang} />
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a href="#anza" className="inline-flex rounded-full bg-sun-deep px-5 py-2.5 font-bold text-white hover:bg-[#b83c00]">
                  {c.heroStartCta} <span aria-hidden="true">&nbsp;↓</span>
                </a>
                <Link prefetch={false} href={`/${lang}/learn/`} className="font-semibold text-dawn underline-offset-4 hover:underline">
                  {c.heroBrowse}
                </Link>
              </div>
              <p data-stats className="mt-3 text-xs text-[#b9cdd3] sm:text-sm">{statItems.join(" · ")}</p>
            </div>
          </div>
        </section>

        <section id="anza" className="scroll-mt-20 bg-earth pt-4 pb-12 text-[#f3e9dc]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <nav data-start aria-labelledby="start-title">
              <h2 id="start-title" className="text-xl font-bold text-white sm:text-2xl">
                {c.startTitle}
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
                {starts.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      prefetch={false}
                      href={href}
                      className="flex h-full items-center rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white hover:border-dawn hover:bg-white/[0.08] sm:px-4 sm:text-base"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>

        <section id="njia" className="bg-earth pb-14 text-[#f3e9dc]" aria-labelledby="njia-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="njia-title" className="sr-only">
              {t(lang, "pathsTitle")}
            </h2>
            <PathCard roadmap={lead.r} lessons={lead.lessons} lang={lang} number={1} outcome={c.leadOutcome} specializations={specializations} />
          </div>
        </section>
      </div>
      <div className="bg-[var(--surface-warm)] pb-16">
        <JoinQuestions lang={lang} />
      </div>
    </>
  );
}
