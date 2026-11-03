"use client";

import { t, type Lang } from "@/lib/i18n";
import type { LessonKey } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/useProgress";

export function MarkComplete({ lessonKey, lang }: { lessonKey: LessonKey; lang: Lang }) {
  const { progress, complete, canPersist } = useProgress();
  const doneAt = progress.lessons[lessonKey]?.completedAt;
  return (
    <div className="my-8">
      {doneAt ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 font-semibold text-white" aria-live="polite">
          <span aria-hidden="true">✓</span> {t(lang, "markedComplete")}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => complete(lessonKey)}
          className="rounded-full border-2 border-teal-600 px-5 py-2.5 font-semibold text-teal-700 hover:bg-teal-600 hover:text-white dark:text-teal-400"
        >
          {t(lang, "markComplete")}
        </button>
      )}
      {!canPersist && <p className="mt-2 text-sm text-[var(--muted)]">{t(lang, "cannotPersist")}</p>}
    </div>
  );
}
