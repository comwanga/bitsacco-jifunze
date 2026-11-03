import Link from "next/link";
import { t, type Lang } from "@/lib/i18n";
import { BitsaccoLogo } from "./BitsaccoLogo";
import { LanguageSwitch } from "./LanguageSwitch";

// Header links never prefetch: they are on screen on every page, so prefetching their routes costs every
// visitor data and makes each page's measured JavaScript depend on how many prefetches finish in time.
export function SiteHeader({ lang }: { lang: Lang }) {
  const nav = [
    { href: `/${lang}/learn/`, label: t(lang, "navPaths") },
    { href: `/${lang}/lightning/`, label: t(lang, "navLabs") },
    { href: `/${lang}/library/`, label: t(lang, "navLibrary") },
    { href: `/${lang}/glossary/`, label: t(lang, "navGlossary") },
    { href: `/${lang}/progress/`, label: t(lang, "navProgress") },
  ];
  return (
    <header className="bg-night text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-ink">
        {t(lang, "skipToContent")}
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-3 pb-2">
        <Link href={`/${lang}/`} prefetch={false} className="flex items-center gap-2 text-white">
          <BitsaccoLogo className="h-9 w-auto text-teal-200" />
          <span className="text-lg font-bold tracking-tight">Jifunze</span>
        </Link>
        <LanguageSwitch lang={lang} />
      </div>
      <nav aria-label={t(lang, "menu")} className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2">
        <ul className="flex gap-5 whitespace-nowrap text-[15px] text-white/80">
          {nav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} prefetch={false} className="inline-block py-1 hover:text-white">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
