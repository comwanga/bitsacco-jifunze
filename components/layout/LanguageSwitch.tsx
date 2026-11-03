"use client";

import { usePathname } from "next/navigation";
import { otherLang, switchHref, t, type Lang } from "@/lib/i18n";

export function LanguageSwitch({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? `/${lang}/`;
  const to = otherLang(lang);
  // The accessible name must contain the visible text (WCAG 2.5.3), so the hint is extra hidden text, not an aria-label.
  return (
    <a
      href={switchHref(pathname, to)}
      hrefLang={to}
      className="rounded-full border border-white/30 px-3 py-1 text-sm font-semibold text-white hover:bg-white/10"
    >
      <span className="sr-only">{t(lang, "switchLabel")}: </span>
      <span lang={to}>{t(lang, "otherLangName")}</span>
    </a>
  );
}
