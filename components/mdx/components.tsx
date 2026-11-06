import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { getExercise } from "../../lib/content/load.ts";
import type { GlossaryTerm } from "../../lib/content/schemas.ts";
import type { Lang } from "../../lib/i18n.ts";
import type { LessonKey } from "../../lib/progress/model.ts";
import type { ExerciseProps } from "../lab/ExerciseRunner.tsx";
import { LazyExerciseRunner } from "../lab/LabIslands.tsx";

const CALLOUT_STYLE = {
  tip: "border-teal-600 bg-teal-50 text-teal-900 dark:bg-teal-900/30 dark:text-teal-50",
  warning: "border-dawn bg-[#fff6e6] text-[#5b3a06] dark:bg-[#3a2a10] dark:text-[#fbe7c4]",
  scam: "border-sun bg-[#fff0e8] text-[#6b2203] dark:bg-[#3d1a0c] dark:text-[#ffd9c4]",
} as const;

const CALLOUT_ICON = { tip: "💡", warning: "⚠️", scam: "🛑" } as const;

export type LessonContext = { lessonKey: LessonKey; lesson: string; exerciseIds: string[]; contentRoot?: string };

export function makeMdxComponents(lang: Lang, glossary: GlossaryTerm[], ctx?: LessonContext) {
  const byId = new Map(glossary.map((g) => [g.id, g]));

  function Table(props: ComponentPropsWithoutRef<"table">) {
    return (
      <div className="lesson-table-scroll" role="group" aria-label={lang === "sw" ? "Jedwali la somo" : "Lesson table"} tabIndex={0}>
        <table {...props} />
      </div>
    );
  }

  function Exercise({ id }: { id: string }) {
    if (!ctx) return null;
    const ex = getExercise(id, ctx.contentRoot);
    return (
      <section data-jifunze-lab="" className="my-8 rounded-2xl border-2 border-[#362c25] p-3" aria-label={ex.title[lang]}>
        <h3 className="m-0 mb-2 flex flex-wrap items-baseline gap-2 text-base font-bold">
          <span aria-hidden="true">⚡</span>
          {ex.title[lang]}
          {ex.profile === "full" && (
            <span className="rounded-full bg-dawn/25 px-2 py-0.5 text-xs font-semibold text-[#7a4b06] dark:text-dawn">--full</span>
          )}
        </h3>
        <LazyExerciseRunner
          lang={lang}
          exercise={{ id: ex.id, title: ex.title[lang], node: ex.node, tab: ex.tab, profile: ex.profile, starter: ex.starter } satisfies ExerciseProps}
          lessonKey={ctx.lessonKey}
          lesson={ctx.lesson}
          allIds={ctx.exerciseIds}
        />
      </section>
    );
  }

  function Term({ id, children }: { id: string; children?: ReactNode }) {
    const g = byId.get(id);
    if (!g) return <span>{children ?? id}</span>;
    return (
      <a href={`/${lang}/glossary/#${id}`} className="term" title={g.definition[lang]}>
        <dfn>{children ?? g[lang]}</dfn>
      </a>
    );
  }

  function Callout({ type = "tip", title, children }: { type?: keyof typeof CALLOUT_STYLE; title?: string; children: ReactNode }) {
    return (
      <aside data-type={type} className={`not-prose my-6 rounded-r-lg border-l-4 px-4 py-3 ${CALLOUT_STYLE[type] ?? CALLOUT_STYLE.tip}`}>
        {title && (
          <p className="m-0 font-bold">
            <span aria-hidden="true">{CALLOUT_ICON[type] ?? CALLOUT_ICON.tip} </span>
            {title}
          </p>
        )}
        <div className="callout-body">{children}</div>
      </aside>
    );
  }

  return { Term, Callout, Exercise, table: Table };
}
