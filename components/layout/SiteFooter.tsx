import Link from "next/link";
import { siteCopy } from "@/lib/site-copy";
import { REPO_URL } from "@/lib/site";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { BrandLockup } from "./BrandLockup";

type FooterLink = { label: string; href: string; external?: boolean };

function Group({ id, title, links }: { id: string; title: string; links: FooterLink[] }) {
  const cls = "inline-block py-1 text-white/75 underline-offset-4 hover:text-white hover:underline";
  return (
    <div>
      <h2 id={id} className="text-sm font-semibold text-dawn">
        {title}
      </h2>
      <ul className="mt-3 space-y-1.5" aria-labelledby={id}>
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a className={cls} href={l.href}>
                {l.label}
              </a>
            ) : (
              <Link prefetch={false} className={cls} href={l.href}>
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Closes every page: who we are, where to go next, and the disclaimer and licences. */
export function SiteFooter({ lang }: { lang: Lang }) {
  const p = (s: string) => `/${lang}/${s}`;
  const l = (key: DictKey, href: string): FooterLink => ({ label: t(lang, key), href });
  const c = siteCopy[lang];
  return (
    <footer className="bg-night text-white/75">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div>
            <BrandLockup lang={lang} size="lg" prefetch={false} />
            <p className="mt-5 max-w-xs text-base text-white/85">{c.footerTagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            <Group
              id="footer-learning"
              title={c.footerLearning}
              links={[l("navPaths", p("learn/")), l("navLabs", p("lightning/")), { label: c.navPractice, href: p("simulations/") }, l("navProgress", p("progress/"))]}
            />
            <Group
              id="footer-resources"
              title={c.footerResources}
              links={[
                l("navLibrary", p("library/")),
                l("navGlossary", p("glossary/")),
                { label: t(lang, "footerCredits"), href: `${REPO_URL}/blob/main/ATTRIBUTIONS.md`, external: true },
              ]}
            />
            <Group
              id="footer-project"
              title={c.footerProject}
              links={[
                { label: "GitHub", href: REPO_URL, external: true },
                { label: "Bitsacco.com", href: "https://bitsacco.com", external: true },
              ]}
            />
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm md:flex-row md:items-start md:justify-between md:gap-8">
          <p className="max-w-prose">{t(lang, "footerNoAdvice")}</p>
          <p className="shrink-0 text-white/60">{t(lang, "footerLicence")}</p>
        </div>
      </div>
    </footer>
  );
}
