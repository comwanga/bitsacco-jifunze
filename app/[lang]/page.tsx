import Link from "next/link";
import { BaobabScene } from "@/components/intro/BaobabScene";
import { RoadmapProgress } from "@/components/roadmap/RoadmapProgress";
import { flatLessons, getLesson, listRoadmaps } from "@/lib/content/load";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { introScript } from "@/lib/intro/shouldPlay";

const BRANCH: Record<string, DictKey> = { savers: "branchSavers", builders: "branchBuilders" };

const LOOP: [DictKey, DictKey][] = [
  ["loop1Title", "loop1Body"],
  ["loop2Title", "loop2Body"],
  ["loop3Title", "loop3Body"],
  ["loop4Title", "loop4Body"],
];

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const paths = listRoadmaps().map((r) => {
    const slugs = flatLessons(r);
    const lessons = slugs.map((s) => getLesson(r.id, s, lang));
    return { r, slugs, lessons, minutes: lessons.reduce((m, l) => m + l.frontmatter.minutes, 0) };
  });

  return (
    <>
      <section className="bg-earth">
        <script dangerouslySetInnerHTML={{ __html: introScript() }} />
        <div className="h-[clamp(380px,58svh,640px)] bg-night">
          <BaobabScene lang={lang} />
        </div>
        <div className="hero-copy mx-auto max-w-6xl px-4 pt-2 pb-14 text-[#fbf1e1]">
          <h1 className="text-[2.6rem] leading-[1.05] font-extrabold tracking-tight sm:text-6xl">{t(lang, "heroTitle")}</h1>
          <p className="mt-2 text-xl font-semibold text-dawn sm:text-2xl">{t(lang, "heroSubtitle")}</p>
          <p className="mt-4 max-w-xl text-lg text-[#e3d5c5]">{t(lang, "heroLead")}</p>
          <a
            href="#njia"
            className="mt-7 inline-flex rounded-full bg-sun px-6 py-3 text-base font-bold text-white shadow-[0_4px_18px_rgba(255,88,0,.35)] hover:bg-[#e94f00]"
          >
            {t(lang, "startLearning")}
          </a>
        </div>
      </section>

      <section id="njia" className="scroll-mt-4 bg-earth pb-16 text-[#f3e9dc]" aria-labelledby="njia-title">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="njia-title" className="sr-only">
            {t(lang, "pathsTitle")}
          </h2>
          <div className="grid gap-12 md:grid-cols-2 md:gap-10">
            {paths.map(({ r, slugs, lessons, minutes }) => (
              <article key={r.id} className="relative pl-6">
                <span
                  aria-hidden="true"
                  className="absolute top-1 bottom-0 left-0 w-[3px] rounded-full bg-gradient-to-b from-dawn via-ember/70 to-transparent"
                />
                <p className="text-sm font-semibold text-dawn">{t(lang, BRANCH[r.id])}</p>
                <h3 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{r.title[lang]}</h3>
                <p className="mt-2 max-w-prose text-[#d9cbbb]">{r.description[lang]}</p>
                <p className="mt-2 text-sm text-[#b9a896]">
                  {slugs.length} {t(lang, "lessons")}, {minutes} {t(lang, "minutes")}
                </p>
                <ol className="mt-4 space-y-1.5 text-[15px] text-[#e9ddcf]">
                  {lessons.map((l, i) => (
                    <li key={l.slug} className="flex gap-3">
                      <span className="w-5 shrink-0 text-right text-[#9c8a78] tabular-nums">{i + 1}</span>
                      <Link prefetch={false} href={`/${lang}/${r.id}/${l.slug}/`} className="hover:text-white hover:underline">
                        {l.frontmatter.title}
                      </Link>
                    </li>
                  ))}
                </ol>
                <RoadmapProgress roadmap={r.id} slugs={slugs} lang={lang} />
                <Link
                  href={`/${lang}/${r.id}/`}
                  className="mt-6 inline-flex rounded-full border border-dawn/60 px-5 py-2.5 font-semibold text-dawn hover:bg-dawn hover:text-earth"
                >
                  {t(lang, "openPath")}: {r.title[lang]}
                </Link>
              </article>
            ))}
          </div>
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
