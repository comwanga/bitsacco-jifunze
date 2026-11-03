"use client";

import { useSyncExternalStore } from "react";
import type { RoadmapId } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";
import { useProgress } from "@/lib/progress/useProgress";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function SectionProgress({ roadmap, slugs, lang }: { roadmap: RoadmapId; slugs: string[]; lang: Lang }) {
  const { progress } = useProgress();
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (!ready) return null;
  const done = slugs.filter((s) => progress.lessons[`${roadmap}/${s}`]?.completedAt).length;
  return (
    <span className="ml-3 inline-block text-sm font-normal text-[var(--muted)]" aria-live="polite" aria-atomic="true">
      {done} / {slugs.length} {t(lang, "done")}
    </span>
  );
}
