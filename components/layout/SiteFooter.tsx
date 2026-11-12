import Link from "next/link";
import { REPO_URL } from "@/lib/site";
import { siteCopy } from "@/lib/site-copy";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { BrandLockup } from "./BrandLockup";
import type { ReactNode } from "react";
import { FeedbackLink } from "@/components/FeedbackLink";

type FooterLink = { label: string; href: string; external?: boolean };

function Group({ id, title, links, children }: { id: string; title: string; links: FooterLink[]; children?: ReactNode }) {
  const cls = "inline-block py-1 text-[15px] text-white/75 underline-offset-4 hover:text-white hover:underline";
  return (
    <div>
      <h2 id={id} className="text-sm font-semibold text-dawn">
        {title}
      </h2>
      <ul className="mt-2 space-y-0.5" aria-labelledby={id}>
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
        {children && <li>{children}</li>}
      </ul>
    </div>
  );
}

/** Closes every page: who we are, where to go next, and the disclaimer with the licences beside it. */
export function SiteFooter({ lang }: { lang: Lang }) {
  const p = (s: string) => `/${lang}/${s}`;
  const l = (key: DictKey, href: string): FooterLink => ({ label: t(lang, key), href });
  const c = siteCopy[lang];
  return (
    <footer className="bg-night text-white/75">
      <div className="mx-auto max-w-[96rem] px-4 pt-10 pb-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-x-10">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <BrandLockup lang={lang} size="lg" />
            <p className="mt-3 max-w-xs text-white/85">{c.footerTagline}</p>
          </div>
          <Group
            id="footer-learning"
            title={c.footerLearning}
            links={[
              l("navPaths", p("learn/")),
              { label: c.footerLab, href: p("lightning/") },
              { label: c.footerPractice, href: p("simulations/") },
              l("navProgress", p("progress/")),
            ]}
          />
          <Group
            id="footer-resources"
            title={c.footerResources}
            links={[
              l("navLibrary", p("library/")),
              l("navGlossary", p("glossary/")),
              { label: t(lang, "footerCredits"), href: `${REPO_URL}/blob/main/ATTRIBUTIONS.md`, external: true },
            ]}
          ><FeedbackLink lang={lang} className="text-white/75 hover:text-white" /></Group>
          <Group
            id="footer-project"
            title={c.footerProject}
            links={[
              { label: "GitHub", href: REPO_URL, external: true },
              { label: "Bitsacco.com", href: "https://bitsacco.com", external: true },
            ]}
          />
        </div>
        <div data-footer-legal className="mt-6 flex flex-col gap-x-6 gap-y-1 border-t border-white/10 pt-5 text-sm md:flex-row md:justify-between">
          <p>{t(lang, "footerNoAdvice")}</p>
          <p className="text-white/60 md:shrink-0 md:text-right">{t(lang, "footerLicence")}</p>
        </div>
      </div>
    </footer>
  );
}
