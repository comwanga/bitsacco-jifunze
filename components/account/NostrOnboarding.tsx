import { nostrOnboardingCopy } from "@/lib/nostr-onboarding-copy";
import type { Lang } from "@/lib/i18n";

const link = "font-semibold text-[var(--accent)] underline decoration-2 underline-offset-4";

/** Public, server-rendered guidance passed into the sign-in island; ships no client dictionary. */
export function NostrOnboarding({ lang }: { lang: Lang }) {
  const c = nostrOnboardingCopy[lang];
  return <div id="nostr-onboarding" className="mb-5 max-w-prose space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
    <p>{c.nostrIntro}</p>
    <ol className="list-decimal space-y-4 pl-5">
      <li><p>{c.nostrCreateStep}</p><a className={link} href="https://guides.getalby.com/user-guide/browser-extension/features/nostr" target="_blank" rel="noopener noreferrer">{c.nostrGuide}</a><p className="mt-2 text-sm text-[var(--muted)]">{c.nostrGuideNote}</p></li>
      <li><p>{c.nostrBackupStep}</p><a className={link} href="https://guides.getalby.com/user-guide/browser-extension/features/master-key" target="_blank" rel="noopener noreferrer">{c.nostrBackupGuide}</a><p className="mt-2">{c.nostrPublicHelp}</p><p className="mt-2">{c.nostrLossHelp}</p></li>
      <li>{c.nostrReturnStep}</li>
    </ol>
  </div>;
}
