"use client";

import { useEffect, useRef, useState } from "react";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { ACCOUNT_KEY, STATUS_KEY } from "@/lib/progress/keys";
import { apiFetch, type ApiErrorCode, type Me } from "./api";
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
export function SignOut({ lang, copy: l }: { lang: Lang; copy: { forget: string; forgotten: string; forgetFailed: string } }) {
  const c = accountCopy[lang];
  const [state, setState] = useState<State>({ kind: "idle" });
  const [linked, setLinked] = useState(false);
  const [remove, setRemove] = useState(true);
  const [identity, setIdentity] = useState<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [pageAccount, setPageAccount] = useState<string | null>(null);
  const [removeIdentity, setRemoveIdentity] = useState(true);
  const [identityOutcome, setIdentityOutcome] = useState<"removed" | "failed" | null>(null);
  const locked = useRef(false);

  useEffect(() => {
    void Promise.all([
      deviceIsLinked(),
      import("@/lib/nostr/device-identity").then((m) => m.deviceIdentity()).catch(() => undefined),
      apiFetch<Me>("/api/me"),
    ]).then(([hasProgress, id, me]) => {
      setLinked(hasProgress);
      if (!me.ok && me.code !== "unauthenticated") { setState({ kind: "error", code: me.code }); return; }
      setPageAccount(me.ok ? me.data.account.id : "anonymous");
      // An external account must not accidentally remove a different learner's retained device identity.
      const ownsIdentity = !me.ok || me.data.identities.some((i) => i.provider === "nostr" && i.pubkey === id?.pubkey);
      setIdentity(id === undefined ? "unavailable" : id && ownsIdentity ? id.pubkey : null);
    }).finally(() => setIdentityReady(true));
  }, []);

  async function signOut() {
    if (locked.current || !pageAccount) return;
    locked.current = true;
    setState({ kind: "working" });
    const current = await apiFetch<Me>("/api/me", { expectedAccount: pageAccount });
    if (!current.ok && current.code !== "unauthenticated") {
      setState({ kind: "error", code: current.code }); locked.current = false; return;
    }
    // A last sync while the session still exists, so nothing written here is left behind unsaved.
    let saved = false;
    const account = pageAccount === "anonymous" ? null : pageAccount;
    try {
      if (await deviceIsLinked()) saved = (await (await sync()).syncNow()) === "synced";
    } catch { /* the sync code could not be loaded: treat the work as unsent */ }
    const res = await apiFetch("/api/auth/logout", { method: "POST", expectedAccount: pageAccount });
    // 401: there was no session to end, which is the outcome the reader asked for.
    if (!res.ok && res.code !== "unauthenticated") {
      setState({ kind: "error", code: res.code });
      locked.current = false;
      return;
    }
    let outcome: Outcome = "kept";
    try { window.localStorage.removeItem(ACCOUNT_KEY); window.localStorage.removeItem(STATUS_KEY); } catch { /* storage unavailable */ }
    if (linked) {
      try {
        const m = await sync();
        m.signedOut(); // also removes the sync timer and listeners
        if (remove) {
          if (saved && account && m.canForgetDevice(account)) { m.forgetDevice(); outcome = "removed"; }
          else outcome = "unsent";
        }
      } catch { if (remove) outcome = "unsent"; }
    }
    if (identity && removeIdentity) {
      try {
        if (identity === "unavailable") throw new Error("storage");
        await (await import("@/lib/nostr/device-identity")).forgetIdentity(identity);
        setIdentityOutcome("removed");
      } catch { setIdentityOutcome("failed"); }
    }
    setState({ kind: "done", outcome });
  }

  if (state.kind === "done") {
    return (
      <>
        {/* The button the reader pressed is gone, so focus moves to the result. */}
        <StatusNote focus>{state.outcome === "removed" ? c.signedOutRemoved : state.outcome === "unsent" ? c.signedOutUnsent : c.signedOutDone}</StatusNote>
        {identityOutcome && <p role={identityOutcome === "failed" ? "alert" : undefined} className="mt-4">{identityOutcome === "failed" ? l.forgetFailed : l.forgotten}</p>}
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
      {state.kind === "error" && <ErrorAlert lang={lang} code={state.code} focus>{!pageAccount && <button type="button" className={`mt-3 ${primaryBtn}`} onClick={() => window.location.reload()}>{c.retry}</button>}</ErrorAlert>}
      {identity && <label className="mt-4 flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={state.kind === "working"} checked={removeIdentity} onChange={(e) => setRemoveIdentity(e.target.checked)} />{l.forget}</label>}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" disabled={!identityReady || !pageAccount || state.kind === "working"} onClick={() => void signOut()} className={primaryBtn}>
          {state.kind === "working" ? c.signingOut : c.signOut}
        </button>
        <a href={`/${lang}/account/`} className={textLink}>
          {c.toAccount}
        </a>
      </div>
    </>
  );
}
