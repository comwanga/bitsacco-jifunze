import { ACCOUNTS_AVAILABLE, GITHUB_SIGNIN } from "@/lib/site";
import { AccountUnavailable } from "@/components/account/AccountUnavailable";
import type { Metadata } from "next";
import { SignIn } from "@/components/account/SignIn";
import { learningIdentityCopy } from "@/lib/learning-identity-copy";
import { remoteSigningCopy } from "@/lib/remote-signing-copy";
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
  const l = learningIdentityCopy[lang];
  return (
    <div data-nostr-signin className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{c.signinHeading}</h1>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{l.lead}</p>
      <p className="mt-4">{l.how}</p>
      <p className="mt-4 text-sm">{l.warning}</p>
      <p className="mt-3 text-sm">{l.shared}</p>
      <SignIn remoteLabel={remoteSigningCopy[lang].choose} lang={lang} github={GITHUB_SIGNIN} copy={l} />
    </div>
  );
}
