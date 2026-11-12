"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch, type ApiErrorCode, type Me } from "./api";
import { ErrorAlert, RecoveryCodes, RetryError, SignedOutPrompt, textLink } from "./parts";

type State = { kind: "loading" } | { kind: "codes"; codes: string[]; nostr: boolean } | { kind: "signedOut" } | { kind: "issued" } | { kind: "error"; code: ApiErrorCode };

/**
 * A new account lands here once. The API issues the first set of codes exactly once per account (409 after),
 * so a reload shows "already shown" instead of new codes. The ref keeps a double-run effect from asking twice.
 */
export function Welcome({ lang, exitGuidance }: { lang: Lang; exitGuidance: ReactNode }) {
  const c = accountCopy[lang];
  const [state, setState] = useState<State>({ kind: "loading" });
  const asked = useRef(false);
  const router = useRouter();

  async function issue() {
    setState({ kind: "loading" });
    const me = await apiFetch<Me>("/api/me");
    if (!me.ok) { setState(me.code === "unauthenticated" ? { kind: "signedOut" } : { kind: "error", code: me.code }); return; }
    const res = await apiFetch<{ codes?: unknown }>("/api/me/recovery-codes/initial", { method: "POST" });
    if (res.ok) {
      const codes = Array.isArray(res.data?.codes) ? res.data.codes.filter((x): x is string => typeof x === "string") : [];
      setState(codes.length ? { kind: "codes", codes, nostr: me.data.identities.some((i) => i.provider === "nostr") } : { kind: "error", code: "internal" });
    } else if (res.code === "unauthenticated") setState({ kind: "signedOut" });
    else if (res.code === "codes_already_issued") setState({ kind: "issued" });
    else setState({ kind: "error", code: res.code });
  }

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void issue();
  }, []);

  switch (state.kind) {
    case "loading":
      return <p role="status" className="mt-6 text-[var(--muted)]">{c.issuing}</p>;
    case "signedOut":
      return <SignedOutPrompt lang={lang} />;
    case "issued":
      return (
        <ErrorAlert lang={lang} code="codes_already_issued">
          <p className="mt-3">
            <a href={`/${lang}/account/`} className={textLink}>
              {c.toAccount}
            </a>
          </p>
        </ErrorAlert>
      );
    case "error":
      // Only a failure that never reached the API is safe to retry; after anything else the codes may already exist.
      return state.code === "network" ? <RetryError lang={lang} code={state.code} onRetry={() => void issue()} /> : (
        <ErrorAlert lang={lang} code={state.code}>
          <p className="mt-3">
            <a href={`/${lang}/account/`} className={textLink}>
              {c.toAccount}
            </a>
          </p>
        </ErrorAlert>
      );
    case "codes":
      return (
        <>
          <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{state.nostr ? c.nostrWelcomeLead : c.welcomeLead}</p>
          <RecoveryCodes lang={lang} codes={state.codes} focusOnShow={false} onContinue={() => router.push(`/${lang}/account/`)} />
          {exitGuidance}
        </>
      );
  }
}
