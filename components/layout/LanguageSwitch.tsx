"use client";

import { usePathname } from "next/navigation";
import { otherLang, switchHref, t, type Lang } from "@/lib/i18n";

export function LanguageSwitch({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? `/${lang}/`;
  const to = otherLang(lang);
  return (
    <a
      href={switchHref(pathname, to)}
      hrefLang={to}
      lang={to}
      aria-label={t(lang, "switchLabel")}
      className="rounded-full border border-white/30 px-3 py-1 text-sm font-semibold text-white hover:bg-white/10"
    >
      {t(lang, "otherLangName")}
    </a>
  );
}
