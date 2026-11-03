"use client";

import { t, type Lang } from "@/lib/i18n";
import type { RoadmapId } from "@/lib/content/schemas";
import { useProgress } from "@/lib/progress/useProgress";

export function ProgressTick({ roadmap, slug, n, lang }: { roadmap: RoadmapId; slug: string; n: number; lang: Lang }) {
  const { progress } = useProgress();
  const p = progress.lessons[`${roadmap}/${slug}`];
  const done = Boolean(p?.completedAt);
  return (
    <span className="flex shrink-0 flex-col items-center gap-1">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
          done ? "bg-teal-600 text-white" : "border-2 border-[var(--line)] text-[var(--muted)]"
        }`}
      >
        {done ? <span aria-label={t(lang, "completed")}>✓</span> : n}
      </span>
      {p?.quiz && (
        <span className="text-[11px] text-[var(--muted)] tabular-nums" title={t(lang, "quizBest")}>
          {p.quiz.correct}/{p.quiz.total}
        </span>
      )}
    </span>
  );
}
