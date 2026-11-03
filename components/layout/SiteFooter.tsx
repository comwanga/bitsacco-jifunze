import { REPO_URL } from "@/lib/site";
import { t, type Lang } from "@/lib/i18n";

export function SiteFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="bg-earth px-4 py-10 text-sm text-[#cdbfb1]">
      <div className="mx-auto max-w-6xl space-y-2">
        <p className="max-w-prose">{t(lang, "footerNoAdvice")}</p>
        <p>{t(lang, "footerLicence")}</p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <a className="underline underline-offset-2 hover:text-white" href={`${REPO_URL}/blob/main/ATTRIBUTIONS.md`}>
            {t(lang, "footerCredits")}
          </a>
          <a className="underline underline-offset-2 hover:text-white" href={REPO_URL}>
            GitHub
          </a>
          <a className="underline underline-offset-2 hover:text-white" href="https://bitsacco.com">
            Bitsacco.com
          </a>
        </p>
      </div>
    </footer>
  );
}
