import Link from "next/link";
import type { TreePath } from "@/lib/content/tree";
import { t, type Lang } from "@/lib/i18n";
import { ProgressTick } from "./ProgressTick";
import { SectionProgress } from "./SectionProgress";
import "./tree.css";

export function PathTree({ tree, lang }: { tree: TreePath; lang: Lang }) {
  return <div className="mx-auto max-w-5xl px-4 py-10">
    {tree.sections.map((s) => <section key={s.id} className="mb-12" aria-labelledby={`tree-${s.id}`}>
      <h2 id={`tree-${s.id}`} className="text-xl font-bold md:text-center">{s.title}<SectionProgress roadmap={tree.id} slugs={s.lessons.map((l) => l.slug)} lang={lang} /></h2>
      <ol className="learning-tree mt-6">
        {s.lessons.map((l) => <li key={l.slug} data-tree-lesson={l.slug} className="tree-node">
          <article className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <ProgressTick roadmap={tree.id} slug={l.slug} n={l.n} lang={lang} />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold leading-snug"><Link prefetch={false} href={`/${lang}/${tree.id}/${l.slug}/`} className="underline decoration-teal-600/50 underline-offset-4 hover:text-teal-700 dark:hover:text-teal-400">{l.title}</Link></h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{l.minutes} {t(lang, "minutes")} · {t(lang, `level_${l.level}`)}</p>
                <ul className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]" aria-label={t(lang, "catalogType")}>
                  {l.types.map((kind) => <li key={kind} className="rounded-full border border-[var(--line)] px-2 py-1">{t(lang, `type_${kind}`)}</li>)}
                </ul>
              </div>
            </div>
            {l.prerequisites.length > 0 && <div data-prerequisites className="mt-4 border-t border-[var(--line)] pt-3 text-sm">
              <p className="text-[var(--muted)]">{t(lang, "readFirst")}</p>
              <ul className="mt-1 space-y-1">{l.prerequisites.map((p) => <li key={p.slug}><Link prefetch={false} href={`/${lang}/${tree.id}/${p.slug}/`} className="text-teal-700 underline underline-offset-2 dark:text-teal-400">{p.title}</Link></li>)}</ul>
            </div>}
          </article>
        </li>)}
      </ol>
    </section>)}
  </div>;
}
