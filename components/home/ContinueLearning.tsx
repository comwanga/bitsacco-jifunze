"use client";

import Link from "next/link";
import { t, type Lang } from "@/lib/i18n";
import { continueLearning, type PathOrder } from "@/lib/progress/next";
import { useProgress } from "@/lib/progress/useProgress";

/** "Continue learning: <path> · <lesson>". Renders nothing on the server or before any activity. */
export function ContinueLearning({
  lang,
  paths,
  titles,
  pathTitles,
}: {
  lang: Lang;
  paths: PathOrder[];
  titles: Record<string, string>;
  pathTitles: Record<string, string>;
}) {
  const { progress } = useProgress();
  const up = continueLearning(progress, paths);
  if (!up) return null;
  return (
    <div data-continue className="mt-8 max-w-xl rounded-2xl border border-dawn/40 bg-white/5 p-4">
      <p className="text-sm text-[#e3d5c5]">
        {t(lang, "continueTitle")}: {pathTitles[up.roadmap]} ·
      </p>
      <Link href={`/${lang}/${up.roadmap}/${up.slug}/`} className="mt-1 block text-lg font-bold text-white underline-offset-4 hover:underline">
        {titles[`${up.roadmap}/${up.slug}`]}
      </Link>
    </div>
  );
}
