"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { accountCopy, errorText } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch, dropQueryParams, githubStart, queryParam, safeReturn, type Me } from "./api";
import { ACCOUNT_KEY, IDENTITY_KEY } from "@/lib/progress/keys";
import { ErrorAlert, primaryBtn, secondaryBtn } from "./parts";

type Copy = { save: string; resume: string; saving: string; storage: string; advanced: string; advancedLead: string; publicId: string };
type Advanced = ComponentType<{ lang: Lang; returnTo: string; disabled: boolean; onBusyChange: (busy: boolean) => void; remoteLabel: string }>;

/** `github` is fixed at build time: the button exists only where the deployment mounts the GitHub routes. */
export function SignIn({ lang, github, copy, remoteLabel }: { lang: Lang; github: boolean; copy: Copy; remoteLabel: string }) {
  const c = accountCopy[lang];
  // The server-rendered link already works without JavaScript; the browser adds a safe ?return= if one was given.
  const [returnTo, setReturnTo] = useState(`/${lang}/account/`);
  const [pageError, setPageError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [nostrBusy, setNostrBusy] = useState(false);
  // The public key of the learning identity already on this device, if any: wording only, never a credential.
  const [known, setKnown] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [Advanced, setAdvanced] = useState<Advanced | null>(null);
  const [open, setOpen] = useState(false);
  const leaving = useRef(false), locked = useRef(false), saveAlert = useRef<HTMLParagraphElement>(null);
  const authBusy = busy || nostrBusy || saving;
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadAdvanced = useCallback(() => {
    void import("./AdvancedSignIn").then((m) => setAdvanced(() => m.default)).catch(() => setSaveError(errorText(lang, "network")));
  }, [lang]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the static page reads its query only in the browser */
    setReturnTo(safeReturn(lang, queryParam("return")));
    setPageError(queryParam("error"));
    setReady(true);
    try { setKnown(window.localStorage.getItem(IDENTITY_KEY)); } catch { /* storage unavailable */ }
    // A learner who follows a link for their own signer, or the signing window, starts in the advanced section.
    if (window.location.hash === "#own" || window.location.hash === "#remote") { setOpen(true); loadAdvanced(); }
    /* eslint-enable react-hooks/set-state-in-effect */
    dropQueryParams(["error"]); // shown once; ?return= stays for the link

    // Restore the recovery form. Nostr owns its attempt state, including any still-pending request.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) { setBusy(false); if (leaving.current) { leaving.current = false; locked.current = false; setSaving(false); } }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [lang, loadAdvanced]);

  useEffect(() => { if (saveError) saveAlert.current?.focus(); }, [saveError]);

  /** One press: use the learning identity on this device, making it first if there is none, and open the account. */
  async function save() {
    if (authBusy || locked.current) return;
    locked.current = true;
    setSaving(true); setSaveError(null);
    try {
      const [{ ensureIdentity }, { prepareProof }] = await Promise.all([import("@/lib/nostr/device-identity"), import("./nostr-proof")]);
      let identity;
      try { identity = await ensureIdentity(); } catch { setSaveError(copy.storage); return; }
      setKnown(identity.pubkey);
      const me = await apiFetch<Me>("/api/me");
      if (me.ok) {
        if (me.data.scope !== "full" || !me.data.identities.some((i) => i.provider === "nostr" && i.pubkey === identity.pubkey)) {
          setSaveError(errorText(lang, "account_changed")); return;
        }
        try { window.localStorage.setItem(ACCOUNT_KEY, me.data.account.id); } catch { /* optional hint */ }
        leaving.current = true;
        window.location.assign(me.data.account.recoveryCodesIssued ? returnTo : `/${lang}/account/welcome/`);
        return;
      }
      if (me.code !== "unauthenticated") { setSaveError(errorText(lang, me.code)); return; }
      const prepared = await prepareProof<{ redirect: string }>("signin", lang, "anonymous", { returnTo });
      const result = prepared.ok ? await prepared.data.complete(identity.signer, () => {}) : prepared;
      if (!result.ok) { setSaveError(errorText(lang, result.code)); return; }
      // A hint for the progress sync that someone is signed in. It holds no token.
      try { window.localStorage.setItem(ACCOUNT_KEY, "?"); } catch { /* storage unavailable: sync stays off */ }
      leaving.current = true;
      window.location.assign(safeReturn(lang, result.data.redirect));
    } catch { setSaveError(errorText(lang, "network")); }
    finally { if (!leaving.current) { locked.current = false; setSaving(false); } }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // never a native submission: the CSP has form-action 'none'
    if (authBusy) return;
    if (!code.trim()) {
      setFormError(c.recoveryCodeEmpty);
      inputRef.current?.focus();
      return;
    }
    // Only a recovery code belongs in this form. Never forward keys, seed words or signer passwords.
    if (!/^[A-Z2-7]{16}$/.test(code.toUpperCase().replace(/[-\s]/g, ""))) {
      setCode(""); setFormError(c.error_recovery_invalid); inputRef.current?.focus(); return;
    }
    setBusy(true);
    setFormError(null);
    const submitted = code.trim(); setCode("");
    const res = await apiFetch("/api/auth/recovery", { method: "POST", body: { code: submitted } });
    if (res.ok) {
      // Stay in the language the code was entered in. The API's redirect names the account's saved language,
      // which can differ, so it is not followed. A full page load on purpose: the recovery page starts fresh
      // with the new session cookie.
      try { window.localStorage.removeItem("jifunze:account:v1"); } catch { /* storage unavailable */ }
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
      <p className="mt-6">
        <button type="button" disabled={!ready || authBusy} className={primaryBtn} onClick={() => void save()} data-save-progress>
          {saving ? copy.saving : known ? copy.resume : copy.save}
        </button>
      </p>
      {github && <p className="mt-4">
        <a href={githubStart("signin", lang, returnTo)} className={secondaryBtn} aria-disabled={authBusy || undefined} tabIndex={authBusy ? -1 : undefined} onClick={(e) => { if (authBusy) e.preventDefault(); }}>
          {c.continueGithub}
        </a>
      </p>}
      {saveError && <p ref={saveAlert} role="alert" tabIndex={-1} className="mt-3 rounded-xl bg-[#fff0e8] p-3 text-[#6b2203] dark:bg-[#3d1a0c] dark:text-[#ffd9c4]">{saveError}</p>}
      <details open={open} onToggle={(e) => { setOpen(e.currentTarget.open); if (e.currentTarget.open) loadAdvanced(); }} className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
        <summary className="cursor-pointer font-semibold">{copy.advanced}</summary>
        <p className="mt-4 text-[var(--muted)]">{copy.advancedLead}</p>
        {known && <p className="mt-3 text-sm">{copy.publicId} <span translate="no" className="block break-all font-mono" data-device-pubkey>{known}</span></p>}
        {Advanced && <Advanced lang={lang} returnTo={returnTo} disabled={authBusy} onBusyChange={setNostrBusy} remoteLabel={remoteLabel} />}
      </details>
      <details className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
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
            type="password"
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
