"use client";

import { useEffect, useState } from "react";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { ACCOUNT_KEY } from "@/lib/progress/keys";
import { apiFetch, type ApiErrorCode } from "./api";
import { ErrorAlert, primaryBtn, StatusNote, textLink } from "./parts";

type Outcome = "kept" | "removed" | "unsent";
type State = { kind: "idle" } | { kind: "working" } | { kind: "error"; code: ApiErrorCode } | { kind: "done"; outcome: Outcome };

// Loaded on demand, and only when this browser has a sign-in marker.
const sync = () => import("@/lib/progress/sync");

/** True when this device holds progress and that copy belongs to the signed-in account. */
async function deviceIsLinked(): Promise<boolean> {
  try {
    const account = window.localStorage.getItem(ACCOUNT_KEY);
    if (!account || account === "?") return false;
    const m = await sync();
    return m.deviceHasProgress() && m.ownership(account) === "mine";
  } catch {
    return false;
  }
}

/**
 * Signs out only when the reader presses the button. Opening this page (a link from another site, a reload,
 * Back, a prerender) never ends a session. The POST is a fetch, never a form: the CSP has form-action 'none'.
 *
 * On a device whose progress is saved to this account, the learner chooses whether a copy stays behind (the
 * safe default on a shared phone is that it does not). Progress is removed only after the account has confirmed
 * it holds everything; anything unsent is always kept.
 */
export function SignOut({ lang }: { lang: Lang }) {
  const c = accountCopy[lang];
  const [state, setState] = useState<State>({ kind: "idle" });
  const [linked, setLinked] = useState(false);
  const [remove, setRemove] = useState(true);

  useEffect(() => {
    void deviceIsLinked().then(setLinked);
  }, []);

  async function signOut() {
    setState({ kind: "working" });
    // A last sync while the session still exists, so nothing written here is left behind unsaved.
    let saved = false;
    try {
      if (await deviceIsLinked()) saved = (await (await sync()).syncNow()) === "synced";
    } catch { /* the sync code could not be loaded: treat the work as unsent */ }
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    // 401: there was no session to end, which is the outcome the reader asked for.
    if (!res.ok && res.code !== "unauthenticated") {
      setState({ kind: "error", code: res.code });
      return;
    }
    let outcome: Outcome = "kept";
    try { window.localStorage.removeItem(ACCOUNT_KEY); } catch { /* storage unavailable */ }
    if (linked) {
      try {
        const m = await sync();
        m.signedOut(); // also removes the sync timer and listeners
        if (remove) {
          if (saved) { m.forgetDevice(); outcome = "removed"; }
          else outcome = "unsent";
        }
      } catch { if (remove) outcome = "unsent"; }
    }
    setState({ kind: "done", outcome });
  }

  if (state.kind === "done") {
    return (
      <>
        {/* The button the reader pressed is gone, so focus moves to the result. */}
        <StatusNote focus>{state.outcome === "removed" ? c.signedOutRemoved : state.outcome === "unsent" ? c.signedOutUnsent : c.signedOutDone}</StatusNote>
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
      {linked && (
        <fieldset disabled={state.kind === "working"} className="mt-4 space-y-2">
          <legend className="font-semibold">{c.signOutProgress}</legend>
          <label className="flex items-start gap-2"><input type="radio" name="device-progress" className="mt-1" checked={remove} onChange={() => setRemove(true)} />{c.signOutRemove}</label>
          <label className="flex items-start gap-2"><input type="radio" name="device-progress" className="mt-1" checked={!remove} onChange={() => setRemove(false)} />{c.signOutKeep}</label>
        </fieldset>
      )}
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
