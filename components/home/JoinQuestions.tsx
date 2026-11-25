import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { siteCopy } from "@/lib/site-copy";

// Each question links to the lesson that answers it today; the Evaluate checklists can replace these later.
const QUESTIONS = [
  { id: "holds", key: "questionHolds", lesson: "custody-and-fedimint", fill: "bg-night" },
  { id: "leave", key: "questionLeave", lesson: "cooperative-foundations", fill: "bg-teal-700" },
  { id: "cost", key: "questionCost", lesson: "payments-liquidity", fill: "bg-sun-deep" },
] as const;

/** Three questions to ask about any chama, SACCO or savings app, as slanted cards. */
export function JoinQuestions({ lang }: { lang: Lang }) {
  const c = siteCopy[lang];
  return (
    <section data-questions aria-labelledby="questions-title" className="mx-auto max-w-6xl px-4 pt-12 pb-6 sm:px-6 sm:pt-16">
      <h2 id="questions-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
        {c.questionsTitle}
      </h2>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-2">
        {QUESTIONS.map((q, i) => (
          <li key={q.id}>
            <Link
              prefetch={false}
              data-question={q.id}
              href={`/${lang}/savers/${q.lesson}/`}
              className={`group block h-full ${q.fill} px-5 py-5 text-white sm:-skew-x-6 sm:px-6 sm:py-7`}
            >
              <span className="block sm:skew-x-6">
                <span aria-hidden="true" className="block text-sm font-bold tabular-nums text-white">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-1 block text-xl leading-snug font-bold sm:text-2xl">{c[q.key]}</span>
                <span className="mt-3 block text-sm font-semibold underline-offset-4 group-hover:underline">
                  {c.questionRead} <span aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
