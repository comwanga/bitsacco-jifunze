"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";

export type GlossaryRow = { id: string; term: string; other: string; definition: string };

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function GlossaryList({ lang, rows }: { lang: Lang; rows: GlossaryRow[] }) {
  const [q, setQ] = useState("");
  const needle = norm(q.trim());
  const shown = needle ? rows.filter((r) => norm(`${r.term} ${r.other} ${r.definition}`).includes(needle)) : rows;
  const otherLang = lang === "sw" ? "en" : "sw";
  return (
    <>
      <label className="mt-6 block">
        <span className="sr-only">{t(lang, "glossaryFilter")}</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(lang, "glossaryFilter")}
          className="w-full rounded-xl border-2 border-[var(--line)] bg-transparent px-4 py-3 text-base focus:border-teal-600 focus:outline-none"
        />
      </label>
      {shown.length === 0 && <p className="mt-6 text-[var(--muted)]">{t(lang, "glossaryEmpty")}</p>}
      <dl className="mt-6 divide-y divide-[var(--line)]">
        {shown.map((r) => (
          <div key={r.id} id={r.id} className="scroll-mt-4 py-4 target:bg-dawn/15">
            <dt className="text-lg font-bold">
              {r.term}
              {norm(r.other) !== norm(r.term) && (
                <span className="font-normal text-[var(--muted)]" lang={otherLang}>
                  {" "}
                  ({r.other})
                </span>
              )}
            </dt>
            <dd className="mt-1">{r.definition}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
