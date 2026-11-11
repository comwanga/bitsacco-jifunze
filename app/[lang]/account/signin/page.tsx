import { ACCOUNTS_AVAILABLE, GITHUB_SIGNIN } from "@/lib/site";
import { AccountUnavailable } from "@/components/account/AccountUnavailable";
import type { Metadata } from "next";
import { SignIn } from "@/components/account/SignIn";
import { NostrOnboarding } from "@/components/account/NostrOnboarding";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return { title: accountCopy[lang].titleSignin, robots: { index: false } };
}

// A static shell; the island talks to the account API from the browser.
export default async function SignInPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  if (!ACCOUNTS_AVAILABLE) return <AccountUnavailable lang={lang} />;
  const c = accountCopy[lang];
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{c.signinHeading}</h1>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{c.signinChoiceLead}</p>
      <SignIn lang={lang} github={GITHUB_SIGNIN} onboarding={<NostrOnboarding lang={lang} />} />
    </div>
  );
}
