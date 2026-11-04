"use client";

import { useState } from "react";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch, type ApiErrorCode } from "./api";
import { ErrorAlert, primaryBtn, StatusNote, textLink } from "./parts";

type State = { kind: "idle" } | { kind: "working" } | { kind: "error"; code: ApiErrorCode } | { kind: "done" };

/**
 * Signs out only when the reader presses the button. Opening this page (a link from another site, a reload,
 * Back, a prerender) never ends a session. The POST is a fetch, never a form: the CSP has form-action 'none'.
 */
export function SignOut({ lang }: { lang: Lang }) {
  const c = accountCopy[lang];
  const [state, setState] = useState<State>({ kind: "idle" });

  async function signOut() {
    setState({ kind: "working" });
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    // 401: there was no session to end, which is the outcome the reader asked for.
    if (res.ok || res.code === "unauthenticated") setState({ kind: "done" });
    else setState({ kind: "error", code: res.code });
  }

  if (state.kind === "done") {
    return (
      <>
        {/* The button the reader pressed is gone, so focus moves to the result. */}
        <StatusNote focus>{c.signedOutDone}</StatusNote>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a href={`/${lang}/account/signin/`} className={primaryBtn}>
            {c.signInAgain}
          </a>
          <a href={`/${lang}/`} className={textLink}>
            {c.keepLearning}
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{c.signOutLead}</p>
      {state.kind === "error" && <ErrorAlert lang={lang} code={state.code} focus />}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" disabled={state.kind === "working"} onClick={() => void signOut()} className={primaryBtn}>
          {state.kind === "working" ? c.signingOut : c.signOut}
        </button>
        <a href={`/${lang}/account/`} className={textLink}>
          {c.toAccount}
        </a>
      </div>
    </>
  );
}
