"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { accountCopy, errorText } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { ACCOUNT_KEY } from "@/lib/progress/keys";
import { apiFetch, safeReturn } from "./api";
import { secondaryBtn } from "./parts";

type Signer = { signEvent: (event: { created_at: number; kind: number; tags: string[][]; content: string }) => Promise<unknown> };
const getSigner = (): Signer | undefined => {
  const signer = (window as Window & { nostr?: Signer }).nostr;
  return typeof signer?.signEvent === "function" ? signer : undefined;
};

export function NostrSignIn({ lang, returnTo, disabled, onBusyChange, onboarding }: { lang: Lang; returnTo: string; disabled: boolean; onBusyChange: (busy: boolean) => void; onboarding: ReactNode }) {
  const c = accountCopy[lang];
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [beginner, setBeginner] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const navigating = useRef(false);
  const alertRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- browser extension availability is checked after hydration */
    setAvailable(!!getSigner()); setChecked(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => { if (error) alertRef.current?.focus(); }, [error]);
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      // Only a completed attempt can be reset; a pending signer request must stay locked.
      if (!event.persisted || !navigating.current) return;
      navigating.current = false;
      locked.current = false;
      setStatus(null);
      onBusyChange(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [onBusyChange]);

  async function signIn() {
    if (locked.current || disabled) return;
    const signer = getSigner();
    if (!signer) { setAvailable(false); return; }
    locked.current = true;
    onBusyChange(true); setError(null); setStatus(c.nostrPending);
    try {
      const challenge = await apiFetch<{ challengeId: string; nonce: string; url: string }>("/api/auth/nostr/challenge", { method: "POST", body: { lang, returnTo } });
      if (!challenge.ok) { setError(errorText(lang, challenge.code)); return; }
      if (challenge.data.url !== window.location.origin + "/api/auth/nostr/verify") { setError(c.nostrFailed); return; }
      const rawBody = JSON.stringify({ challengeId: challenge.data.challengeId, nonce: challenge.data.nonce });
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody));
      const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
      const template = { created_at: Math.floor(Date.now() / 1000), kind: 27235, tags: [["u", challenge.data.url], ["method", "POST"], ["payload", hash]], content: "" };
      const expectedTime = template.created_at;
      const expectedTags = JSON.stringify(template.tags);
      let event: unknown;
      try {
        event = await signer.signEvent(template);
      } catch (err) {
        const reason = err as { code?: unknown; message?: unknown };
        setError(reason?.code === 4001 || (typeof reason?.message === "string" && /reject|denied|declin|cancel/i.test(reason.message)) ? c.nostrDeclined : c.nostrFailed);
        return;
      }
      const signed = event as { id?: unknown; pubkey?: unknown; sig?: unknown; created_at?: unknown; kind?: unknown; tags?: unknown; content?: unknown } | null;
      if (!signed || signed.created_at !== expectedTime || signed.kind !== 27235 || signed.content !== ""
        || JSON.stringify(signed.tags) !== expectedTags
        || typeof signed.id !== "string" || !/^[0-9a-f]{64}$/.test(signed.id)
        || typeof signed.pubkey !== "string" || !/^[0-9a-f]{64}$/.test(signed.pubkey)
        || typeof signed.sig !== "string" || !/^[0-9a-f]{128}$/.test(signed.sig)) {
        setError(c.error_nostr_invalid); return;
      }
      setStatus(c.nostrApproved);
      // Forward only standard public proof fields; never serialize arbitrary signer properties.
      const bytes = new TextEncoder().encode(JSON.stringify(signed, ["id", "pubkey", "sig", "created_at", "kind", "tags", "content"]));
      const authorization = "Nostr " + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
      const result = await apiFetch<{ redirect: string }>("/api/auth/nostr/verify", { method: "POST", rawBody, authorization });
      if (!result.ok) { setError(errorText(lang, result.code)); return; }
      // A hint for the progress sync that someone is signed in. It holds no token; the account id is asked for later.
      try { window.localStorage.setItem(ACCOUNT_KEY, "?"); } catch { /* storage unavailable: sync stays off */ }
      // A full navigation starts account state fresh with the server's HttpOnly session cookie.
      window.location.assign(safeReturn(lang, result.data.redirect));
      navigating.current = true;
    } catch { setError(c.nostrFailed); }
    finally { if (!navigating.current) { locked.current = false; onBusyChange(false); setStatus(null); } }
  }

  return <div className="mt-4">
    <fieldset disabled={disabled} className="mb-4 space-y-3">
      <legend className="mb-2 font-semibold">{c.nostrChoice}</legend>
      <label className="flex items-center gap-2"><input type="radio" name="nostr-experience" checked={!beginner} onChange={() => setBeginner(false)} />{c.nostrExisting}</label>
      <label className="flex items-center gap-2"><input type="radio" name="nostr-experience" checked={beginner} onChange={() => setBeginner(true)} />{c.nostrNew}</label>
    </fieldset>
    {beginner && onboarding}
    {checked && !available && <p className="mb-4"><button type="button" className={secondaryBtn} disabled={disabled} onClick={() => setAvailable(!!getSigner())}>{c.nostrCheckSigner}</button></p>}
    <button type="button" className={secondaryBtn} disabled={!available || disabled} onClick={() => void signIn()} aria-describedby={checked && !available ? "nostr-help" : undefined}>{c.continueNostr}</button>
    {checked && !available && <p id="nostr-help" className="mt-3 max-w-prose text-[var(--muted)]">{c.nostrNoSigner}</p>}
    <p role="status" aria-live="polite" className="mt-3 text-[var(--muted)]">{status}</p>
    {error && <p ref={alertRef} role="alert" tabIndex={-1} className="mt-3 rounded-xl bg-[#fff0e8] p-3 text-[#6b2203] dark:bg-[#3d1a0c] dark:text-[#ffd9c4]">{error}</p>}
  </div>;
}
