"use client";

import Link from "next/link";
import type { RoadmapId } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";
import { choosePathView } from "./PathPresentation";
import { useLayoutEffect } from "react";

export function PathViewLinks({ lang, roadmap, view }: { lang: Lang; roadmap: RoadmapId; view: "list" | "tree" }) {
  useLayoutEffect(() => choosePathView(view), [view]);
  return <nav aria-label={t(lang, "pathView")} className="mt-5 flex gap-2 text-sm font-semibold">
    {(["list", "tree"] as const).map((v) => <Link key={v} prefetch={false} href={v === "list" ? `/${lang}/list/${roadmap}/` : `/${lang}/tree/${roadmap}/`}
      onClick={() => choosePathView(v)}
      aria-current={v === view ? "page" : undefined} className={`rounded-full border px-4 py-2 ${v === view ? "border-white bg-white text-night" : "border-white/40 text-white hover:bg-white/10"}`}>
      {t(lang, v === "list" ? "viewList" : "viewTree")}
    </Link>)}
  </nav>;
}
