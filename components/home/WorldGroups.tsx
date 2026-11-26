import type { ReactNode } from "react";
import type { WorldGroup } from "@/lib/content/schemas";
import type { Lang } from "@/lib/i18n";
import { siteCopy } from "@/lib/site-copy";

/** Savings-group names from around the world. Each name opens to one sourced line; no JavaScript needed. */
export function WorldGroups({ lang, groups, map }: { lang: Lang; groups: WorldGroup[]; map?: ReactNode }) {
  const c = siteCopy[lang];
  return (
    <section data-world aria-labelledby="world-title" className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <h2 id="world-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
        {c.worldTitle}
      </h2>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">{c.worldLead}</p>
      {map}
      <ul data-world-list className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <li key={g.id}>
            <details className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3">
              <summary className="cursor-pointer font-semibold">
                <span>{g.name}</span>
                <span className="font-normal text-[var(--muted)]"> · {g.place[lang]}</span>
              </summary>
              <p className="mt-2 text-sm">
                {g.line[lang]}{" "}
                <a href={g.source} className="whitespace-nowrap text-teal-700 underline underline-offset-2 dark:text-teal-400" rel="noopener">
                  {c.worldSource}
                </a>
              </p>
            </details>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-[var(--muted)]">{c.worldCaveat}</p>
    </section>
  );
}
