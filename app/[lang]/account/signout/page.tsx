import { ACCOUNTS_AVAILABLE } from "@/lib/site";
import { AccountUnavailable } from "@/components/account/AccountUnavailable";
import type { Metadata } from "next";
import { SignOut } from "@/components/account/SignOut";
import { accountCopy } from "@/lib/account-copy";
import { learningIdentityCopy } from "@/lib/learning-identity-copy";
import type { Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return { title: accountCopy[lang].titleSignout, robots: { index: false } };
}

// A static shell; the island talks to the account API from the browser.
export default async function SignOutPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  if (!ACCOUNTS_AVAILABLE) return <AccountUnavailable lang={lang} />;
  const c = accountCopy[lang];
  const l = learningIdentityCopy[lang];
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{c.titleSignout}</h1>
      <SignOut lang={lang} copy={{ forget: l.forget, forgotten: l.forgotten, forgetFailed: l.forgetFailed }} />
    </div>
  );
}
