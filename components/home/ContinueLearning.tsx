"use client";

import Link from "next/link";
import { t, type Lang } from "@/lib/i18n";
import { continueLearning, type PathOrder } from "@/lib/progress/next";
import { useProgress } from "@/lib/progress/useProgress";

/** The next unfinished lesson, with a full-duration estimate when metadata is available. */
export function ContinueLearning({
  lang,
  paths,
  titles,
  pathTitles,
  minutes,
}: {
  lang: Lang;
  paths: PathOrder[];
  titles: Record<string, string>;
  pathTitles: Record<string, string>;
  minutes: Record<string, number>;
}) {
  const { progress } = useProgress();
  const up = continueLearning(progress, paths);
  if (!up) return null;
  // Activity timestamps and quiz scores do not measure reading time. Use the full estimate.
  const estimate = minutes[`${up.roadmap}/${up.slug}`];
  return (
    <div data-continue className="mt-8 max-w-xl rounded-2xl border border-dawn/40 bg-white/5 p-4">
      <p className="text-sm text-[#e3d5c5]">
        {pathTitles[up.roadmap]}
      </p>
      <p className="mt-1 text-lg font-bold text-white">{titles[`${up.roadmap}/${up.slug}`]}</p>
      <p className="mt-2 text-sm text-[#e3d5c5]">
        {t(lang, "continueEncouragement")}{" "}
        {Number.isFinite(estimate) && estimate > 0 ? t(lang, "continueEstimate").replace("{minutes}", String(estimate)) : ""}
      </p>
      <Link href={`/${lang}/${up.roadmap}/${up.slug}/`} className="mt-3 inline-block rounded-full bg-sun-deep px-5 py-2.5 font-semibold text-white">
        {t(lang, "continueTitle")}
      </Link>
    </div>
  );
}
