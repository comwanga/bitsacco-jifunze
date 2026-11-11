"use client";

import Link from "next/link";
import type { RoadmapId } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";
import { nextInPath } from "@/lib/progress/next";
import { useProgress } from "@/lib/progress/useProgress";

/** Start / Continue / Review, linking to the next lesson in the path (the first one again once all are done). */
export function ResumeLink({
  roadmap,
  slugs,
  lang,
  className,
  describedBy,
  optionalSections,
}: {
  roadmap: RoadmapId;
  slugs: string[];
  lang: Lang;
  className?: string;
  describedBy?: string;
  optionalSections?: string[][];
}) {
  const { progress } = useProgress();
  const next = nextInPath(progress, { id: roadmap, slugs, optionalSections });
  const started = slugs.some((s) => progress.lessons[`${roadmap}/${s}`]?.completedAt);
  const choose = next === null && Boolean(optionalSections?.length);
  const label = choose ? "chooseSpecialization" : next === null ? "resumeReview" : started ? "resumeContinue" : "resumeStart";
  return (
    <Link data-resume aria-describedby={describedBy} href={choose ? `/${lang}/${roadmap}/#specializations` : `/${lang}/${roadmap}/${next ?? slugs[0]}/`} className={className}>
      {t(lang, label)}
    </Link>
  );
}
