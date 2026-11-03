"use client";

import Link from "next/link";
import { useState } from "react";
import { filterCatalog, type CatalogEntry, type LessonType } from "@/lib/content/catalog-filter";
import { t, type Lang } from "@/lib/i18n";

export function CatalogList({ lang, entries }: { lang: Lang; entries: CatalogEntry[] }) {
  const [text, setText] = useState("");
  const [roadmap, setRoadmap] = useState("");
  const [level, setLevel] = useState("");
  const [type, setType] = useState<LessonType | "">("");
  const shown = filterCatalog(entries, { text, roadmap, level, type: type || undefined });
  const paths = [...new Map(entries.map((e) => [e.roadmap, e.roadmapTitle])).entries()];
  const control = "mt-1 w-full rounded-xl border-2 border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-base";
  function clear() {
    setText(""); setRoadmap(""); setLevel(""); setType("");
  }
  return (
    <>
      <div role="search" className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="sm:col-span-3">
          <span className="font-semibold">{t(lang, "catalogSearch")}</span>
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} className={control} />
        </label>
        <label>
          <span className="font-semibold">{t(lang, "catalogPath")}</span>
          <select value={roadmap} onChange={(e) => setRoadmap(e.target.value)} className={control}>
            <option value="">{t(lang, "catalogAllPaths")}</option>
            {paths.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label>
          <span className="font-semibold">{t(lang, "catalogLevel")}</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={control}>
            <option value="">{t(lang, "catalogAllLevels")}</option>
            {(["beginner", "intermediate", "advanced"] as const).map((l) => <option key={l} value={l}>{t(lang, `level_${l}`)}</option>)}
          </select>
        </label>
        <label>
          <span className="font-semibold">{t(lang, "catalogType")}</span>
          <select value={type} onChange={(e) => setType(e.target.value as LessonType | "")} className={control}>
            <option value="">{t(lang, "catalogAllTypes")}</option>
            {(["reading", "quiz", "lab"] as const).map((kind) => <option key={kind} value={kind}>{t(lang, `type_${kind}`)}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-5 text-sm text-[var(--muted)]" role="status" aria-live="polite" aria-atomic="true">
        {t(lang, "catalogResults")}: {shown.length} / {entries.length}
      </p>
      {(text || roadmap || level || type) && (
        <button type="button" onClick={clear} className="mt-3 rounded-full border border-teal-600 px-4 py-2 font-semibold text-teal-700 dark:text-teal-400">
          {t(lang, "catalogClear")}
        </button>
      )}
      {shown.length === 0 && <p className="mt-6">{t(lang, "catalogEmpty")}</p>}
      <ul className="mt-6 divide-y divide-[var(--line)]">
        {shown.map((e) => (
          <li key={`${e.roadmap}/${e.slug}`} data-catalog-entry={`${e.roadmap}/${e.slug}`} className="py-5">
            <p className="text-sm text-[var(--muted)]">{e.roadmapTitle} · {e.section} · {e.n}</p>
            <h2 className="mt-1 text-xl font-bold" lang={e.contentLang !== lang ? e.contentLang : undefined}>
              <Link prefetch={false} href={`/${lang}/${e.roadmap}/${e.slug}/`} className="underline decoration-teal-600/50 underline-offset-4 hover:text-teal-700 dark:hover:text-teal-400">{e.title}</Link>
            </h2>
            <p className="mt-1 text-[var(--muted)]" lang={e.contentLang !== lang ? e.contentLang : undefined}>{e.description}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              <span>{e.minutes} {t(lang, "minutes")}</span>
              <span>{t(lang, `level_${e.level}`)}</span>
              {e.types.map((kind) => <span key={kind} className="rounded-full border border-[var(--line)] px-2 py-0.5">{t(lang, `type_${kind}`)}</span>)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
