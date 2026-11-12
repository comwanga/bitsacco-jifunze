"use client";

import { useEffect, useRef, useState } from "react";
import { accountSecurityCopy } from "@/lib/account-security-copy";
import { accountCopy, errorText } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch, type Me } from "./api";
import { remoteSigningCopy } from "@/lib/remote-signing-copy";
import { openRemoteSigner } from "@/lib/nostr/remote-popup";
import { prepareProof, prove, type ProofError, type ProofResult } from "./nostr-proof";
import { card, primaryBtn, RecoveryCodes, secondaryBtn, SignedOutPrompt, StatusNote, textLink } from "./parts";

type Action = "codes" | "replace" | "delete" | "logout";
type State = { kind: "idle" } | { kind: "reauth" | "confirm"; action: Action } | { kind: "working"; action: Action }
  | { kind: "codes"; codes: string[]; outcome?: "replaced" | "unchanged" }
  | { kind: "done"; message: string } | { kind: "signedOut" } | { kind: "changed" };
const sync = () => import("@/lib/progress/sync");

/** Loaded after /me confirms a Nostr account. Sensitive actions always have a separate, deliberate confirmation. */
export default function AccountSecurity({ lang, accountId, recovery = false, onSessionEnded }: { lang: Lang; accountId: string; recovery?: boolean; onSessionEnded?: () => void }) {
  const c = accountSecurityCopy[lang], a = accountCopy[lang];
  const [state, setState] = useState<State>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [signing, setSigning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [removeLocal, setRemoveLocal] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const focusRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (state.kind === "reauth" || state.kind === "confirm") focusRef.current?.focus(); }, [state]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  // One-time codes stay in memory only; leaving the page never caches them in browser storage.
  useEffect(() => {
    if (state.kind !== "codes") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const forget = () => { setState({ kind: "idle" }); setError(null); };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", forget);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("pagehide", forget); };
  }, [state.kind]);

  function start(action: Action) {
    if (locked.current) return;
    setError(null); setConfirmed(false); setRemoveLocal(false); setUncertain(false);
    setState({ kind: recovery || action === "logout" ? "confirm" : "reauth", action });
  }
  function cancel() {
    setState({ kind: "idle" }); setError(null);
    requestAnimationFrame(() => actionsRef.current?.focus());
  }
  function failure(code: ProofError, changing = false) {
    if (code === "account_changed") { setState({ kind: "changed" }); onSessionEnded?.(); return; }
    if (changing && (code === "network" || code === "internal")) setUncertain(true);
    if (code === "unauthenticated") { void sync().then((m) => m.sessionExpired()).catch(() => {}); setState({ kind: "signedOut" }); onSessionEnded?.(); }
    setError(code === "no-signer" ? c.noSigner : code === "declined" ? c.declined
      : changing && (code === "network" || code === "internal") ? c.uncertain : errorText(lang, code));
  }

  async function currentAccount(): Promise<boolean> {
    // The HttpOnly session can change in another tab while these controls are open. Never apply the old
    // page's confirmation to a different account or scope; do not clear the new learner's local markers.
    const me = await apiFetch<Me>("/api/me", { expectedAccount: accountId });
    if (!me.ok) { failure(me.code); return false; }
    if (me.data.account.id !== accountId || me.data.scope !== (recovery ? "recovery" : "full")) {
      setState({ kind: "changed" }); onSessionEnded?.(); return false;
    }
    return true;
  }

  async function proof<T>(purpose: "reauth" | "replace", source?: ReturnType<typeof openRemoteSigner>): Promise<ProofResult<T>> {
    if (!source) return prove<T>(purpose, lang, () => setSigning(true), accountId);
    const prepared = await prepareProof<T>(purpose, lang, accountId, { remote: true, signal: source.signal });
    if (!prepared.ok) return prepared;
    await source.ready;
    if (!await currentAccount()) return { ok: false, status: 409, code: "account_changed" };
    return prepared.data.complete(source, () => setSigning(true));
  }

  async function reauthenticate(action: Action, remotely = false) {
    if (locked.current) return;
    locked.current = true; setError(null); setPending(true);
    let source: ReturnType<typeof openRemoteSigner> | undefined;
    try {
      if (remotely) source = openRemoteSigner(lang); // before an await: keep the deliberate popup gesture
      if (!await currentAccount()) return;
      const res = await proof("reauth", source);
      if (res.ok) setState({ kind: "confirm", action });
      else failure(res.code);
    } catch { setError(remoteSigningCopy[lang][source ? "cancelled" : "popup"]); }
    finally { source?.close(); locked.current = false; setPending(false); setSigning(false); }
  }

  async function download() {
    try {
      const file = (await sync()).exportDevice(new Date().toISOString());
      const url = URL.createObjectURL(new Blob([file.text], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = file.name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(errorText(lang, "internal")); }
  }

  async function perform(action: Action, remotely = false) {
    if (locked.current || uncertain || (action === "delete" && !confirmed)) return;
    locked.current = true; setError(null); setPending(true);
    let source: ReturnType<typeof openRemoteSigner> | undefined;
    try {
      if (remotely && action === "replace") source = openRemoteSigner(lang);
      if (!await currentAccount()) return;
      if (action === "replace") {
        const result = await proof<{ codes: string[]; outcome: "replaced" | "unchanged" }>("replace", source);
        if (!result.ok) {
          if (result.code === "reauth_required") setState({ kind: "reauth", action });
          failure(result.code, true); return;
        }
        const codes = result.data?.codes;
        if (!Array.isArray(codes) || codes.length !== 10 || !codes.every((v) => typeof v === "string")) { setError(c.uncertain); setUncertain(true); return; }
        // Keep the same account/owner marker. The server rotated the session, not the learner's account.
        setState({ kind: "codes", codes, outcome: result.data.outcome });
        onSessionEnded?.(); // hide the earlier identity/scope while the one-time codes are being saved
        return;
      }
      if (action === "codes") {
        const res = await apiFetch<{ codes: string[] }>("/api/me/recovery-codes", { method: "POST", expectedAccount: accountId });
        if (!res.ok) {
          if (res.code === "reauth_required") setState({ kind: "reauth", action });
          failure(res.code, true); return;
        }
        if (!Array.isArray(res.data?.codes) || res.data.codes.length !== 10 || !res.data.codes.every((v) => typeof v === "string")) { setError(c.uncertain); setUncertain(true); return; }
        setState({ kind: "codes", codes: res.data.codes }); return;
      }
      const m = await sync();
      // Attempt a final save before logout, and before a requested device removal. Failure always keeps the copy.
      if (!recovery && m.ownership(accountId) === "mine") await m.syncNow();
      const res = await apiFetch(action === "delete" ? "/api/me/delete" : "/api/auth/logout/all", {
        method: "POST", expectedAccount: accountId, ...(action === "delete" ? { body: { confirm: true } } : {}),
      });
      if (!res.ok && !(action === "logout" && res.code === "unauthenticated")) {
        if (res.code === "reauth_required") setState({ kind: "reauth", action });
        failure(res.code, true); return;
      }
      if (action === "delete") {
        const removed = removeLocal && m.canForgetDevice(accountId);
        const keptUnsent = removeLocal && !removed && m.ownership(accountId) === "mine";
        m.accountDeleted(accountId, removed);
        setState({ kind: "done", message: removed ? c.deletedRemoved : keptUnsent ? c.deletedUnsent : c.deleted });
      } else {
        m.signedOut();
        setState({ kind: "done", message: c.loggedOut });
      }
      onSessionEnded?.();
    } catch { setError(c.uncertain); setUncertain(true); }
    finally { source?.close(); locked.current = false; setPending(false); setSigning(false); }
  }

  if (state.kind === "signedOut") return <SignedOutPrompt lang={lang} />;
  if (state.kind === "changed") return <div data-account-security><StatusNote focus>{c.accountChanged}</StatusNote><p className="mt-4"><a href={`/${lang}/account/`} className={textLink}>{a.toAccount}</a></p></div>;
  if (state.kind === "done") return <div className="mt-6" data-account-security><StatusNote focus>{state.message}</StatusNote><p className="mt-4"><a href={`/${lang}/`} className={textLink}>{a.keepLearning}</a></p></div>;
  function continueToAccount() {
    // Refresh account identity and scope from the newly rotated HttpOnly session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${lang}/account/`);
  }
  if (state.kind === "codes") return <div data-account-security>
    <StatusNote>{state.outcome ? state.outcome === "unchanged" ? c.unchanged : c.replaced : a.newCodesDone}</StatusNote>
    <p className="mt-3">{c.backupHelp}</p>
    <RecoveryCodes lang={lang} codes={state.codes} focusOnShow onContinue={continueToAccount} />
  </div>;

  const action = state.kind === "idle" ? null : state.action;
  return <section aria-labelledby="security-heading" className={`mt-6 ${card}`} data-account-security>
    <h2 id="security-heading" className="text-xl font-bold">{recovery ? c.replace : c.heading}</h2>
    {recovery && state.kind === "idle" && <p className="mt-3">{c.replaceHelp}</p>}
    {!recovery && state.kind === "idle" && <p className="mt-3 text-[var(--muted)]">{a.nostrCodesHelp}</p>}
    {state.kind === "idle" ? <div ref={actionsRef} tabIndex={-1} className="mt-4 flex flex-wrap gap-3">
      {!recovery && <button type="button" className={secondaryBtn} onClick={() => start("codes")}>{a.newCodes}</button>}
      <button type="button" className={secondaryBtn} onClick={() => start("replace")}>{c.replace}</button>
      {!recovery && <button type="button" className={secondaryBtn} onClick={() => start("delete")}>{c.delete}</button>}
      <button type="button" className={secondaryBtn} onClick={() => start("logout")}>{c.logoutAll}</button>
    </div> : <div ref={focusRef} tabIndex={-1} className="mt-4 space-y-4">
      {state.kind === "reauth" ? <>
        <p>{c.reauthHelp}</p>
        <button type="button" disabled={pending} className={primaryBtn} onClick={() => void reauthenticate(state.action)}>{c.reauth}</button>
        <button type="button" disabled={pending} className={secondaryBtn} onClick={() => void reauthenticate(state.action, true)}>{remoteSigningCopy[lang].sensitive}</button>
      </> : <>
        {!recovery && action !== "logout" && <p>{c.confirmed}</p>}
        {action === "replace" && <><p>{c.replaceHelp}</p><p>{c.prepare}</p><p>{c.replaceWarning}</p></>}
        {action === "codes" && <><p>{a.newCodesReady}</p><p>{c.backupHelp}</p></>}
        {action === "delete" && <>
          <p>{c.deleteHelp}</p><p>{c.localHelp}</p>
          <p><button type="button" disabled={pending} onClick={() => void download()} className={secondaryBtn}>{c.download}</button></p>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={pending} checked={removeLocal} onChange={(e) => setRemoveLocal(e.target.checked)} />{c.removeLocal}</label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={pending} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{c.deleteConfirm}</label>
        </>}
        {action === "logout" && <p>{c.logoutHelp}</p>}
        <button type="button" disabled={pending || uncertain || (action === "delete" && !confirmed)} className={primaryBtn} onClick={() => action && void perform(action)}>{pending ? c.working : action === "replace" ? c.replaceConfirm : action === "delete" ? c.delete : action === "logout" ? c.logoutConfirm : a.newCodesConfirm}</button>
        {action === "replace" && <button type="button" disabled={pending || uncertain} className={secondaryBtn} onClick={() => void perform("replace", true)}>{remoteSigningCopy[lang].sensitive}</button>}
      </>}
      <button type="button" disabled={pending} className={`${secondaryBtn} ml-3`} onClick={cancel}>{c.cancel}</button>
    </div>}
    <p role="status" aria-live="polite" className="mt-3 text-[var(--muted)]">{pending ? signing ? c.pending : c.working : ""}</p>
    {error && <p ref={errorRef} role="alert" tabIndex={-1} className="mt-4 rounded-xl border border-[var(--line)] p-3">{error}</p>}
    {uncertain && <p className="mt-3"><a href={`/${lang}/account/`} className={textLink}>{a.toAccount}</a></p>}
  </section>;
}
