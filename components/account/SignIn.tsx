"use client";

import { useEffect, useRef, useState } from "react";
import { accountCopy, errorText } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch, githubStart, queryParam, safeReturn } from "./api";
import { ErrorAlert, primaryBtn, secondaryBtn } from "./parts";

// The API answers /{lang}/account/recovery/; anything else is not followed.
const RECOVERY_REDIRECT = /^\/(sw|en)\/account\/recovery\/$/;

export function SignIn({ lang }: { lang: Lang }) {
  const c = accountCopy[lang];
  // The server-rendered link already works without JavaScript; the browser adds a safe ?return= if one was given.
  const [returnTo, setReturnTo] = useState(`/${lang}/account/`);
  const [pageError, setPageError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the static page reads its query only in the browser */
    setReturnTo(safeReturn(lang, queryParam("return")));
    setPageError(queryParam("error"));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lang]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // never a native submission: the CSP has form-action 'none'
    if (busy) return;
    if (!code.trim()) {
      setFormError(c.recoveryCodeEmpty);
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await apiFetch<{ redirect?: unknown }>("/api/auth/recovery", { method: "POST", body: { code: code.trim() } });
    if (res.ok) {
      const to = typeof res.data?.redirect === "string" && RECOVERY_REDIRECT.test(res.data.redirect) ? res.data.redirect : `/${lang}/account/recovery/`;
      window.location.assign(to);
      return;
    }
    setBusy(false);
    setFormError(errorText(lang, res.code));
    inputRef.current?.focus();
  }

  return (
    <>
      {pageError && <ErrorAlert lang={lang} code={pageError} />}
      <p className="mt-8">
        <a href={githubStart("signin", lang, returnTo)} className={primaryBtn}>
          {c.continueGithub}
        </a>
      </p>
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
            <button type="submit" disabled={!ready || busy} className={secondaryBtn}>
              {busy ? c.checking : c.recoveryCodeSubmit}
            </button>
          </p>
        </form>
      </details>
    </>
  );
}
