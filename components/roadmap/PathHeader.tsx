import { ResumeLink } from "@/components/home/ResumeLink";
import type { TreePath } from "@/lib/content/tree";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { RoadmapProgress } from "./RoadmapProgress";
import { PathViewLinks } from "./PathViewLinks";

const BRANCH: Record<TreePath["id"], DictKey> = { savers: "branchSavers", builders: "branchBuilders", lightning: "branchLightning" };

export function PathHeader({ path, lang, slugs, minutes, view }: { path: Pick<TreePath, "id" | "title" | "tagline" | "description">; lang: Lang; slugs: string[]; minutes: number; view: "list" | "tree" }) {
  return <section className="bg-night px-4 pt-6 pb-10 text-white">
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-dawn">{t(lang, BRANCH[path.id])}</p>
      <h1 id="roadmap-title" className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{path.title}</h1>
      <p className="mt-2 text-lg text-white/85">{path.tagline}</p>
      <p className="mt-3 max-w-prose text-white/75">{path.description}</p>
      <p className="mt-3 text-sm text-white/60">{slugs.length} {t(lang, "lessons")}, {minutes} {t(lang, "minutes")}</p>
      <RoadmapProgress roadmap={path.id} slugs={slugs} lang={lang} />
      <ResumeLink roadmap={path.id} slugs={slugs} lang={lang} describedBy="roadmap-title" className="mt-5 inline-block rounded-full bg-sun-deep px-5 py-2.5 font-semibold text-white" />
      <PathViewLinks lang={lang} roadmap={path.id} view={view} />
    </div>
  </section>;
}
