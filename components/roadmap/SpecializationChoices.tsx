import { t, type Lang } from "@/lib/i18n";

export function SpecializationChoices({ sections, lang, prefix }: {
  sections: { id: string; title: string; description?: string; optional?: boolean }[];
  lang: Lang;
  prefix: string;
}) {
  const optional = sections.filter((s) => s.optional);
  if (!optional.length) return null;
  return <nav id="specializations" aria-labelledby="specializations-title" className="mb-10 rounded-2xl border border-[var(--line)] p-5">
    <h2 id="specializations-title" className="text-xl font-bold">{t(lang, "chooseSpecialization")}</h2>
    <p className="mt-2 text-[var(--muted)]">{t(lang, "specializationsLead")}</p>
    <ul className="mt-4 space-y-3">{optional.map((s) => <li key={s.id}>
      <a href={`#${prefix}-${s.id}`} className="font-semibold text-teal-700 underline underline-offset-4 dark:text-teal-400">{s.title}</a>
      {s.description && <p className="mt-1 text-sm text-[var(--muted)]">{s.description}</p>}
    </li>)}</ul>
  </nav>;
}
