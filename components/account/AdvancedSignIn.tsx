"use client";
import type { Lang } from "@/lib/i18n";
import { NostrSignIn } from "./NostrSignIn";
import { RemoteEntry } from "./RemoteEntry";
import { NostrOnboarding } from "./NostrOnboarding";

/** For learners who bring their own Nostr identity. Loaded only when that section is opened. */
export default function AdvancedSignIn({ lang, returnTo, disabled, onBusyChange, remoteLabel }: { lang: Lang; returnTo: string; disabled: boolean; onBusyChange: (busy: boolean) => void; remoteLabel: string }) {
  return <>
    <NostrSignIn lang={lang} returnTo={returnTo} disabled={disabled} onBusyChange={onBusyChange} onboarding={<NostrOnboarding lang={lang} />} />
    <RemoteEntry lang={lang} returnTo={returnTo} label={remoteLabel} disabled={disabled} onBusyChange={onBusyChange} />
  </>;
}
