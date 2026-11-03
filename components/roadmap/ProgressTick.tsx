"use client";

import { t, type Lang } from "@/lib/i18n";
import type { RoadmapId } from "@/lib/content/schemas";
import { useProgress } from "@/lib/progress/useProgress";

/** Lesson number, or a tick once completed. `sm` is the compact form used in the course sidebar. */
export function ProgressTick({ roadmap, slug, n, lang, size = "md" }: { roadmap: RoadmapId; slug: string; n: number; lang: Lang; size?: "md" | "sm" }) {
  const { progress } = useProgress();
  const p = progress.lessons[`${roadmap}/${slug}`];
  const done = Boolean(p?.completedAt);
  const dims = size === "sm" ? "h-6 w-6 text-[11px]" : "h-9 w-9 text-sm";
  return (
    <span className="flex shrink-0 flex-col items-center gap-1">
      <span
        className={`flex ${dims} items-center justify-center rounded-full font-bold tabular-nums ${
          done ? "bg-teal-600 text-white" : "border-2 border-[var(--line)] text-[var(--muted)]"
        }`}
      >
        {done ? <span aria-label={t(lang, "completed")}>✓</span> : n}
      </span>
      {size === "md" && p?.quiz && (
        <span className="text-[11px] text-[var(--muted)] tabular-nums" title={t(lang, "quizBest")}>
          {p.quiz.correct}/{p.quiz.total}
        </span>
      )}
    </span>
  );
}
