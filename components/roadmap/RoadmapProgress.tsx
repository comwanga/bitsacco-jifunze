"use client";

import { t, type Lang } from "@/lib/i18n";
import type { RoadmapId } from "@/lib/content/schemas";
import { useProgress } from "@/lib/progress/useProgress";

export function RoadmapProgress({ roadmap, slugs, lang }: { roadmap: RoadmapId; slugs: string[]; lang: Lang }) {
  const { progress } = useProgress();
  const done = slugs.filter((s) => progress.lessons[`${roadmap}/${s}`]?.completedAt).length;
  if (done === 0) return null;
  return (
    <div className="mt-4" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-teal-400" style={{ width: `${(done / slugs.length) * 100}%` }} />
      </div>
      <p className="mt-1 text-sm text-teal-200">
        {done} / {slugs.length} {t(lang, "done")}
      </p>
    </div>
  );
}
