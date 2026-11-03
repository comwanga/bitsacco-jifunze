import { t, type Lang } from "@/lib/i18n";
import { BrandLockup } from "./BrandLockup";
import { HeaderNav, type NavItem } from "./HeaderNav";
import { LanguageSwitch } from "./LanguageSwitch";

/** Main destinations, with the paths that count as "inside" each one for the current-page marker. */
export function siteNav(lang: Lang): NavItem[] {
  const p = (s: string) => `/${lang}/${s}`;
  return [
    {
      href: p("learn/"),
      label: t(lang, "navPaths"),
      match: [p("learn/"), p("savers/"), p("builders/"), p("tree/savers/"), p("tree/builders/"), p("simulations/")],
    },
    { href: p("lightning/"), label: t(lang, "navLabs"), match: [p("lightning/"), p("tree/lightning/")] },
    { href: p("library/"), label: t(lang, "navLibrary"), match: [p("library/")] },
    { href: p("glossary/"), label: t(lang, "navGlossary"), match: [p("glossary/")] },
    { href: p("progress/"), label: t(lang, "navProgress"), match: [p("progress/")] },
  ];
}

/** One compact row that stays pinned while scrolling: brand left, navigation, language switch right. */
export function SiteHeader({ lang }: { lang: Lang }) {
  return (
    <header data-site-header className="site-header sticky top-0 z-40 h-[var(--header-h)] border-b border-white/10 bg-night text-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-ink"
      >
        {t(lang, "skipToContent")}
      </a>
      <div className="mx-auto flex h-full max-w-6xl items-center gap-8 px-4 sm:px-6">
        <BrandLockup lang={lang} />
        <HeaderNav items={siteNav(lang)} label={t(lang, "menu")} menuLabel={t(lang, "menu")}>
          <LanguageSwitch lang={lang} />
        </HeaderNav>
      </div>
    </header>
  );
}
