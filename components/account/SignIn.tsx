"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { accountCopy, errorText } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch, dropQueryParams, githubStart, queryParam, safeReturn } from "./api";
import { ErrorAlert, primaryBtn, secondaryBtn } from "./parts";
import { NostrSignIn } from "./NostrSignIn";

/** `github` is fixed at build time: the button exists only where the deployment mounts the GitHub routes. */
export function SignIn({ lang, github, onboarding }: { lang: Lang; github: boolean; onboarding: ReactNode }) {
  const c = accountCopy[lang];
  // The server-rendered link already works without JavaScript; the browser adds a safe ?return= if one was given.
  const [returnTo, setReturnTo] = useState(`/${lang}/account/`);
  const [pageError, setPageError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [nostrBusy, setNostrBusy] = useState(false);
  const authBusy = busy || nostrBusy;
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the static page reads its query only in the browser */
    setReturnTo(safeReturn(lang, queryParam("return")));
    setPageError(queryParam("error"));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    dropQueryParams(["error"]); // shown once; ?return= stays for the link

    // Restore the recovery form. Nostr owns its attempt state, including any still-pending request.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [lang]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // never a native submission: the CSP has form-action 'none'
    if (authBusy) return;
    if (!code.trim()) {
      setFormError(c.recoveryCodeEmpty);
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await apiFetch("/api/auth/recovery", { method: "POST", body: { code: code.trim() } });
    if (res.ok) {
      // Stay in the language the code was entered in. The API's redirect names the account's saved language,
      // which can differ, so it is not followed. A full page load on purpose: the recovery page starts fresh
      // with the new session cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/${lang}/account/recovery/`);
      return;
    }
    setBusy(false);
    setFormError(errorText(lang, res.code));
    inputRef.current?.focus();
  }

  return (
    <>
      {pageError && <ErrorAlert lang={lang} code={pageError} />}
      {github && <p className="mt-8">
        <a href={githubStart("signin", lang, returnTo)} className={primaryBtn} aria-disabled={authBusy || undefined} tabIndex={authBusy ? -1 : undefined} onClick={(e) => { if (authBusy) e.preventDefault(); }}>
          {c.continueGithub}
        </a>
      </p>}
      <NostrSignIn lang={lang} returnTo={returnTo} disabled={authBusy} onBusyChange={setNostrBusy} onboarding={onboarding} />
      <details className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
        <summary className="cursor-pointer font-semibold">{c.useRecoveryCode}</summary>
        <form method="post" onSubmit={submit} noValidate className="mt-4">
          <p id="recovery-help" className="text-[var(--muted)]">
            {c.recoveryCodeHelp}
          </p>
          <label htmlFor="recovery-code" className="mt-4 block font-semibold">
            {c.recoveryCodeLabel}
          </label>
          <input
            ref={inputRef}
            id="recovery-code"
            name="code"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={64}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? "recovery-help recovery-error" : "recovery-help"}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="mt-1 block w-full max-w-sm rounded-xl border-2 border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-base tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal"
          />
          {formError && (
            <p id="recovery-error" role="alert" className="mt-3 rounded-xl bg-[#fff0e8] p-3 text-[#6b2203] dark:bg-[#3d1a0c] dark:text-[#ffd9c4]">
              {formError}
            </p>
          )}
          <p className="mt-4">
            <button type="submit" disabled={!ready || authBusy} className={secondaryBtn}>
              {authBusy ? c.checking : c.recoveryCodeSubmit}
            </button>
          </p>
        </form>
      </details>
    </>
  );
}
