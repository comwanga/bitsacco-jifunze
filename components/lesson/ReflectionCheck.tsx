"use client";

import type { LessonKey } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/useProgress";

export function ReflectionCheck({ copy, lessonKey }: { copy: { confirm: string; done: string; recorded: string }; lessonKey: LessonKey }) {
  const { progress, reflect } = useProgress();
  const entry = progress.lessons[lessonKey];
  const done = Boolean(entry?.reflectedAt || entry?.completedAt);
  return <div className="mt-5">
    <button type="button" disabled={done} aria-describedby="reflection-check-hint" onClick={() => reflect(lessonKey)} className="mt-3 rounded-full border-2 border-teal-600 px-5 py-2.5 font-semibold text-teal-700 disabled:opacity-70 dark:text-teal-400">
      {done ? copy.done : copy.confirm}
    </button>
    {done && <p role="status" className="mt-2 text-sm">{copy.recorded}</p>}
  </div>;
}
