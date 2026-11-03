import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import type { LessonKey } from "@/lib/progress/model";
import { simulationsForLesson } from "@/lib/simulations/registry";
import { simulationCopy } from "@/lib/simulations/copy";

export function LessonPracticeLinks({ lessonKey, lang }: { lessonKey: LessonKey; lang: Lang }) {
  const entries = simulationsForLesson(lessonKey);
  if (!entries.length) return null;
  return <section lang={lang} aria-labelledby="practice-title" className="my-8 rounded-2xl border border-teal-600/40 p-5">
    <h2 id="practice-title" className="text-xl font-bold">{simulationCopy[lang].practice}</h2>
    <ul className="mt-3 space-y-2">{entries.map((entry) => <li key={entry.id}>
      <Link prefetch={false} href={`/${lang}/simulations/${entry.id}/`} className="font-semibold text-teal-700 underline underline-offset-4 dark:text-teal-400">{entry.title[lang]}</Link>
      <p className="mt-1 text-sm text-[var(--muted)]">{entry.description[lang]}</p>
    </li>)}</ul>
  </section>;
}
