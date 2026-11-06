import { t, type Lang } from "@/lib/i18n";
import { siteCopy } from "@/lib/site-copy";
import { BrandLockup } from "./BrandLockup";
import { HeaderNav, type NavItem } from "./HeaderNav";
import { LanguageSwitch } from "./LanguageSwitch";
import { ACCOUNTS_AVAILABLE } from "@/lib/site";

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

/** The account link: outside the main navigation list on wide screens (after the language switch), last in the phone menu. */
export function accountNav(lang: Lang): NavItem {
  return { href: `/${lang}/account/`, label: siteCopy[lang].account, match: [`/${lang}/account/`] };
}

/** One compact row pinned by CSS while scrolling: brand on the left, navigation and language switch grouped on the right. */
export function SiteHeader({ lang }: { lang: Lang }) {
  return (
    <header data-site-header className="site-header sticky top-0 z-40 h-[var(--header-h)] border-b border-white/10 bg-night text-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-ink"
      >
        {t(lang, "skipToContent")}
      </a>
      <div className="mx-auto flex h-full max-w-[96rem] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <BrandLockup lang={lang} />
        <HeaderNav items={siteNav(lang)} account={ACCOUNTS_AVAILABLE ? accountNav(lang) : undefined} label={t(lang, "menu")} menuLabel={t(lang, "menu")}>
          <LanguageSwitch lang={lang} />
        </HeaderNav>
      </div>
    </header>
  );
}
