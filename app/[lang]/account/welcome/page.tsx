import { ACCOUNTS_AVAILABLE } from "@/lib/site";
import { AccountUnavailable } from "@/components/account/AccountUnavailable";
import type { Metadata } from "next";
import { Welcome } from "@/components/account/Welcome";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { accountSecurityCopy } from "@/lib/account-security-copy";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return { title: accountCopy[lang].titleWelcome, robots: { index: false } };
}

// A static shell; the island talks to the account API from the browser.
export default async function WelcomePage({ params }: Params) {
  const lang = (await params).lang as Lang;
  if (!ACCOUNTS_AVAILABLE) return <AccountUnavailable lang={lang} />;
  const c = accountCopy[lang];
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{c.welcomeHeading}</h1>
      <Welcome lang={lang} exitGuidance={<details className="mt-6 space-y-3"><summary className="cursor-pointer underline">{accountSecurityCopy[lang].skip}</summary><p>{accountSecurityCopy[lang].skipWarning}</p><a className="inline-flex min-h-11 items-center font-semibold underline" href={`/${lang}/account/`}>{c.toAccount}</a></details>} />
    </div>
  );
}
