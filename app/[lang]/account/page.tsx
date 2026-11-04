import type { Metadata } from "next";
import { AccountHome } from "@/components/account/AccountHome";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return { title: accountCopy[lang].titleHome, robots: { index: false } };
}

// A static shell; the island talks to the account API from the browser.
export default async function AccountHomePage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const c = accountCopy[lang];
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">{c.homeHeading}</h1>
      <AccountHome lang={lang} />
    </div>
  );
}
