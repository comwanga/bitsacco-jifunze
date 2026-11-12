"use client";

import { t, type Lang } from "@/lib/i18n";
import type { LessonKey } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/useProgress";

export function MarkComplete({ lessonKey, lang, localStatus }: { lessonKey: LessonKey; lang: Lang; localStatus: string }) {
  const { progress, complete, canPersist } = useProgress();
  const doneAt = progress.lessons[lessonKey]?.completedAt;
  const ready = Boolean(progress.lessons[lessonKey]?.reflectedAt);
  return (
    <div className="my-8">
      {doneAt ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white" aria-live="polite">
          <span aria-hidden="true">✓</span> {t(lang, "markedComplete")}
        </p>
      ) : (
        <button
          type="button"
          disabled={!ready}
          aria-describedby={!ready ? "completion-requires-reflection" : undefined}
          onClick={() => complete(lessonKey)}
          className="rounded-full border-2 border-teal-600 px-5 py-2.5 font-semibold text-teal-700 enabled:hover:bg-teal-600 enabled:hover:text-white disabled:opacity-50 dark:text-teal-400"
        >
          {t(lang, "markComplete")}
        </button>
      )}
      {!doneAt && !ready && <p id="completion-requires-reflection" className="mt-2 text-sm text-[var(--muted)]"><a href="#reflect" className="underline">{t(lang, "reflectionRequired")}</a></p>}
      <p lang={lang} data-progress-status={canPersist ? "local" : undefined} role="status" aria-live="polite" className="mt-2 text-sm text-[var(--muted)]">{canPersist ? localStatus : t(lang, "cannotPersist")}</p>
    </div>
  );
}
