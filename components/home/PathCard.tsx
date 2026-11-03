import Link from "next/link";
import { RoadmapProgress } from "@/components/roadmap/RoadmapProgress";
import type { Roadmap } from "@/lib/content/schemas";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { ResumeLink } from "./ResumeLink";

export type PathLesson = { slug: string; title: string; minutes: number; level: "beginner" | "intermediate" | "advanced" };

const BRANCH: Record<Roadmap["id"], DictKey> = { savers: "branchSavers", builders: "branchBuilders", lightning: "branchLightning" };
const LEVELS = ["beginner", "intermediate", "advanced"] as const;

function levelRange(lang: Lang, lessons: PathLesson[]): string {
  const used = LEVELS.filter((l) => lessons.some((x) => x.level === l));
  const [lo, hi] = [used[0], used.at(-1)];
  if (!lo || !hi) return "";
  return lo === hi ? t(lang, `level_${lo}`) : `${t(lang, `level_${lo}`)}–${t(lang, `level_${hi}`)}`;
}

/** One learning path on the home page: what it is, how long it takes, where it starts, and a resume button. */
export function PathCard({ roadmap, lessons, lang }: { roadmap: Roadmap; lessons: PathLesson[]; lang: Lang }) {
  const slugs = lessons.map((l) => l.slug);
  const minutes = lessons.reduce((m, l) => m + l.minutes, 0);
  return (
    <article data-path-card={roadmap.id} className="relative flex flex-col pl-6">
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-0 left-0 w-[3px] rounded-full bg-gradient-to-b from-dawn via-ember/70 to-transparent"
      />
      <p className="text-sm font-semibold text-dawn">{t(lang, BRANCH[roadmap.id])}</p>
      <h3 id={`path-${roadmap.id}`} className="mt-1 text-2xl font-bold text-white sm:text-3xl">{roadmap.title[lang]}</h3>
      <p className="mt-2 max-w-prose text-[#d9cbbb]">{roadmap.description[lang]}</p>
      <p className="mt-2 text-sm text-[#b9a896]">
        {slugs.length} {t(lang, "lessons")}, {minutes} {t(lang, "minutes")}, {levelRange(lang, lessons)}
      </p>
      <ol className="mt-4 space-y-1.5 text-[15px] text-[#e9ddcf]">
        {lessons.slice(0, 3).map((l, i) => (
          <li key={l.slug} className="flex gap-3">
            <span className="w-5 shrink-0 text-right text-[#9c8a78] tabular-nums">{i + 1}</span>
            <Link prefetch={false} href={`/${lang}/${roadmap.id}/${l.slug}/`} className="hover:text-white hover:underline">
              {l.title}
            </Link>
          </li>
        ))}
      </ol>
      <RoadmapProgress roadmap={roadmap.id} slugs={slugs} lang={lang} />
      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
        <ResumeLink
          roadmap={roadmap.id}
          slugs={slugs}
          lang={lang}
          describedBy={`path-${roadmap.id}`}
          className="inline-flex rounded-full bg-sun-deep px-5 py-2.5 font-semibold text-white hover:bg-[#b83c00]"
        />
        <Link href={`/${lang}/${roadmap.id}/`} aria-describedby={`path-${roadmap.id}`} className="font-semibold text-dawn underline-offset-4 hover:underline">
          {t(lang, "openPath")}
        </Link>
      </div>
    </article>
  );
}
