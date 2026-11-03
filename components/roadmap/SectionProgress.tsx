"use client";

import { useSyncExternalStore } from "react";
import type { RoadmapId } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";
import { useProgress } from "@/lib/progress/useProgress";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** "1 / 3 done" for one section. Sits beside the section heading so the heading's name stays the title. */
export function SectionProgress({ section, roadmap, slugs, lang }: { section: string; roadmap: RoadmapId; slugs: string[]; lang: Lang }) {
  const { progress } = useProgress();
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (!ready) return null;
  const done = slugs.filter((s) => progress.lessons[`${roadmap}/${s}`]?.completedAt).length;
  return (
    <p data-section-progress={section} className="text-sm text-[var(--muted)]">
      {done} / {slugs.length} {t(lang, "done")}
    </p>
  );
}
