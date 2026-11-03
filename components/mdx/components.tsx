import type { ReactNode } from "react";
import type { GlossaryTerm } from "../../lib/content/schemas.ts";
import type { Lang } from "../../lib/i18n.ts";

const CALLOUT_STYLE = {
  tip: "border-teal-600 bg-teal-50 text-teal-900 dark:bg-teal-900/30 dark:text-teal-50",
  warning: "border-dawn bg-[#fff6e6] text-[#5b3a06] dark:bg-[#3a2a10] dark:text-[#fbe7c4]",
  scam: "border-sun bg-[#fff0e8] text-[#6b2203] dark:bg-[#3d1a0c] dark:text-[#ffd9c4]",
} as const;

const CALLOUT_ICON = { tip: "💡", warning: "⚠️", scam: "🛑" } as const;

export function makeMdxComponents(lang: Lang, glossary: GlossaryTerm[]) {
  const byId = new Map(glossary.map((g) => [g.id, g]));

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

  return { Term, Callout };
}
