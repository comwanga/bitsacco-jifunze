import Link from "next/link";
import { getLesson } from "@/lib/content/load";
import type { RoadmapId } from "@/lib/content/schemas";
import type { Lang } from "@/lib/i18n";
import { simulationCopy } from "@/lib/simulations/copy";
import type { SimulationEntry } from "@/lib/simulations/registry";
import { SimulationLoader } from "./SimulationLoader";

export function SimulationShell({ entry, lang }: { entry: SimulationEntry; lang: Lang }) {
  const c = simulationCopy[lang];
  const utxo = entry.id === "utxo";
  return <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
    <Link prefetch={false} href={`/${lang}/simulations/`} className="text-sm text-teal-700 underline dark:text-teal-400">{c.indexTitle}</Link>
    <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{entry.title[lang]}</h1>
    <p className="mt-3 text-lg text-[var(--muted)]">{entry.description[lang]}</p>
    <p className="mt-5">{utxo ? c.utxoExplain : c.channelExplain}</p>
    <SimulationLoader id={entry.id} lang={lang} c={c} />
    <section aria-labelledby="worked-example" className="rounded-2xl bg-teal-50 p-5 text-teal-900 dark:bg-teal-900/30 dark:text-teal-50">
      <h2 id="worked-example" className="text-xl font-bold">{c.workedExample}</h2>
      <p className="mt-2">{utxo ? c.utxoExample : c.channelExample}</p>
    </section>
    <section aria-labelledby="model-limits" className="mt-8">
      <h2 id="model-limits" className="text-xl font-bold">{c.limitations}</h2>
      <p className="mt-2 text-[var(--muted)]">{utxo ? c.utxoLimits : c.channelLimits}</p>
    </section>
    <nav aria-labelledby="related-lessons" className="mt-8 border-t border-[var(--line)] pt-6">
      <h2 id="related-lessons" className="text-xl font-bold">{c.related}</h2>
      <ul className="mt-3 space-y-2">{entry.lessons.map((key) => {
        const [roadmap, slug] = key.split("/");
        const lesson = getLesson(roadmap as RoadmapId, slug, lang);
        return <li key={key} lang={lesson.isFallback ? lesson.servedLang : undefined}><Link prefetch={false} href={`/${lang}/${key}/`} className="text-teal-700 underline underline-offset-4 dark:text-teal-400">{lesson.frontmatter.title}</Link></li>;
      })}</ul>
    </nav>
  </div>;
}
