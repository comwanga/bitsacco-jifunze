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
  localNote,
  manageLabel,
}: {
  lang: Lang;
  paths: PathOrder[];
  titles: Record<string, string>;
  pathTitles: Record<string, string>;
  minutes: Record<string, number>;
  /** "Saved only in this browser." Passed from the server so the bundled dictionary does not grow. */
  localNote: string;
  manageLabel: string;
}) {
  const { progress } = useProgress();
  const up = continueLearning(progress, paths);
  if (!up) return null;
  // Activity timestamps and quiz scores do not measure reading time. Use the full estimate.
  const estimate = minutes[`${up.roadmap}/${up.slug}`];
  return (
    <div data-continue className="mt-4 max-w-xl rounded-2xl border border-dawn/40 bg-white/5 p-3 sm:mt-8 sm:p-4">
      {/* Small screens get a compact card (less layout shift when it appears); the extra lines stay readable to screen readers. */}
      <p className="sr-only text-sm text-[#e3d5c5] sm:not-sr-only">
        {pathTitles[up.roadmap]}
      </p>
      <p className="text-base font-bold text-white sm:mt-1 sm:text-lg">{titles[`${up.roadmap}/${up.slug}`]}</p>
      <p className="sr-only text-sm text-[#e3d5c5] sm:not-sr-only sm:mt-2 sm:block">
        {t(lang, "continueEncouragement")}{" "}
        {Number.isFinite(estimate) && estimate > 0 ? t(lang, "continueEstimate").replace("{minutes}", String(estimate)) : ""}
      </p>
      <Link href={`/${lang}/${up.roadmap}/${up.slug}/`} className="mt-2 inline-block rounded-full bg-sun-deep px-4 py-2 text-sm font-semibold text-white sm:mt-3 sm:px-5 sm:py-2.5 sm:text-base">
        {t(lang, "continueTitle")}
      </Link>
      <p className="mt-2 text-xs text-[#e3d5c5] sm:mt-3 sm:text-sm">
        {localNote}{" "}
        <Link href={`/${lang}/progress/`} className="font-semibold text-dawn underline underline-offset-4">
          {manageLabel}
        </Link>
      </p>
    </div>
  );
}
