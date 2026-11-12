"use client";

import { useEffect, useRef, useState } from "react";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch, type ApiErrorCode, type ApiResult, dropQueryParams, formatDate, githubStart, queryParam, type Me } from "./api";
import { ACCOUNT_KEY } from "@/lib/progress/keys";
import { card, ErrorAlert, Loading, primaryBtn, RecoveryCodes, RetryError, secondaryBtn, SignedOutPrompt, SignOutLink, StatusNote } from "./parts";

// The progress panel, its text and the sync code are fetched only once an account is confirmed.
type Panel = (typeof import("./ProgressSync"))["default"];

// Set just before the reader is sent to GitHub to confirm it is them, so the page can offer the new codes on return.
// Only ever read to show a confirmation button: coming back never generates codes by itself.
const REAUTH_FLAG = "jifunze-new-codes-after-reauth";
const REAUTH_WINDOW_MS = 10 * 60 * 1000; // the API accepts a re-authentication for 10 minutes

function readFlag(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(REAUTH_FLAG));
    return Number.isFinite(at) && at > 0 && Date.now() - at < REAUTH_WINDOW_MS;
  } catch {
    return false;
  }
}

function setFlag(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(REAUTH_FLAG, String(Date.now()));
    else window.sessionStorage.removeItem(REAUTH_FLAG);
  } catch {
    /* storage blocked: the reader just presses the button again after confirming */
  }
}

type Load = { kind: "loading" } | { kind: "signedOut" } | { kind: "error"; code: ApiErrorCode } | { kind: "me"; me: Me };

function toLoad(res: ApiResult<Me>): Load {
  if (res.ok) return { kind: "me", me: res.data };
  return res.code === "unauthenticated" ? { kind: "signedOut" } : { kind: "error", code: res.code };
}
type Codes =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "working" }
  | { kind: "shown"; codes: string[] }
  | { kind: "done" }
  | { kind: "error"; code: ApiErrorCode };

export function AccountHome({ lang }: { lang: Lang }) {
  const c = accountCopy[lang];
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [codes, setCodes] = useState<Codes>({ kind: "idle" });
  const [pageError, setPageError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // The first load starts in the loading state; a retry sets it again before asking.
  function retry() {
    setLoad({ kind: "loading" });
    void apiFetch<Me>("/api/me").then((res) => setLoad(toLoad(res)));
  }

  useEffect(() => {
    const error = queryParam("error");
    /* eslint-disable react-hooks/set-state-in-effect -- the static page reads its query and storage only in the browser */
    setPageError(error);
    setReplaced(queryParam("replaced") === "github");
    // A failed confirmation comes back with ?error=; offering the button again would only fail the same way.
    if (error) setFlag(false);
    else if (readFlag()) setCodes({ kind: "confirm" });
    /* eslint-enable react-hooks/set-state-in-effect */
    dropQueryParams(["error", "replaced"]); // shown once; a reload does not repeat the banner
    void apiFetch<Me>("/api/me").then((res) => setLoad(toLoad(res)));

    // Back from GitHub can restore this page from the back/forward cache mid-request: re-enable the button.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setCodes((s) => (s.kind === "working" ? { kind: "idle" } : s));
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Back from confirming with GitHub: move focus to the question the reader came back to answer.
  const signedIn = load.kind === "me" && load.me.scope === "full";
  const [Panel, setPanel] = useState<Panel | null>(null);
  useEffect(() => {
    if (signedIn) void import("./ProgressSync").then((m) => setPanel(() => m.default)).catch(() => {});
  }, [signedIn]);
  // The session is gone (expired, or ended elsewhere): stop syncing. The device copy is left as it is.
  useEffect(() => {
    if (load.kind !== "signedOut") return;
    try { window.localStorage.removeItem(ACCOUNT_KEY); } catch { /* storage unavailable */ }
  }, [load.kind]);
  useEffect(() => {
    if (signedIn && codes.kind === "confirm") confirmRef.current?.focus();
  }, [signedIn, codes.kind]);

  async function generate() {
    setFlag(false);
    setCodes({ kind: "working" });
    const res = await apiFetch<{ codes?: unknown }>("/api/me/recovery-codes", { method: "POST" });
    if (res.ok) {
      const list = Array.isArray(res.data?.codes) ? res.data.codes.filter((x): x is string => typeof x === "string") : [];
      setCodes(list.length ? { kind: "shown", codes: list } : { kind: "error", code: "internal" });
      return;
    }
    if (res.code === "reauth_required") {
      if (load.kind === "me" && !load.me.identities.some((i) => i.provider === "github")) {
        setCodes({ kind: "error", code: "reauth_required" });
        return;
      }
      setFlag(true);
      window.location.assign(githubStart("reauth", lang, `/${lang}/account/`));
      return;
    }
    if (res.code === "unauthenticated") {
      setLoad({ kind: "signedOut" });
      return;
    }
    setCodes({ kind: "error", code: res.code });
  }

  function cancel() {
    setFlag(false);
    setCodes({ kind: "idle" });
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  const banner = (
    <>
      {pageError && <ErrorAlert lang={lang} code={pageError} />}
      {replaced && <StatusNote>{c.replacedGithub}</StatusNote>}
    </>
  );

  if (load.kind === "loading") return <>{banner}<Loading lang={lang} /></>;
  if (load.kind === "signedOut") return <>{banner}<SignedOutPrompt lang={lang} /></>;
  if (load.kind === "error") return <>{banner}<RetryError lang={lang} code={load.code} onRetry={retry} /></>;

  const { me } = load;
  if (me.scope === "recovery") {
    return (
      <>
        {banner}
        <div className={`mt-6 ${card}`}>
          <p>{c.recoveryActive}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`/${lang}/account/recovery/`} className={primaryBtn}>
              {c.toRecovery}
            </a>
            <SignOutLink lang={lang} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {banner}
      {me.notices.map((n) => (
        <p key={n.at} className="mt-6 rounded-xl border-l-4 border-sun-deep bg-dawn/20 p-4">
          {c.noticeCodeUsed.replace("{date}", formatDate(lang, n.at))}
        </p>
      ))}

      <section aria-labelledby="identity-heading" className={`mt-6 ${card}`}>
        <h2 id="identity-heading" className="text-xl font-bold">
          {c.identityHeading}
        </h2>
        <ul className="mt-3 space-y-2">
          {me.identities.map((id) => (
            <li key={`${id.provider}-${id.linkedAt}`}>
              <span className="font-semibold">{id.provider === "nostr" ? c.nostr : c.github}</span>
              {id.provider === "nostr" && <span translate="no" className="block break-all font-mono" data-nostr-pubkey>{id.pubkey}</span>}
              {id.handle && (
                <>
                  {": "}
                  <span translate="no" className="font-mono" data-github-handle>
                    @{id.handle}
                  </span>
                </>
              )}
              <span className="block text-sm text-[var(--muted)]">
                {c.linkedOn} {formatDate(lang, id.linkedAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {Panel && <Panel lang={lang} accountId={me.account.id} />}

      <section aria-labelledby="codes-section-heading" className={`mt-6 ${card}`}>
        <h2 id="codes-section-heading" className="text-xl font-bold">
          {c.codesSection}
        </h2>
        {!me.account.recoveryCodesIssued && me.identities.some((i) => i.provider === "github") && <p className="mt-2">{c.noCodesYet}</p>}
        <p className="mt-2 text-[var(--muted)]">{me.identities.some((i) => i.provider === "github") ? c.newCodesHelp : c.nostrCodesHelp}</p>

        {codes.kind === "confirm" ? (
          <div ref={confirmRef} tabIndex={-1} className="mt-4 rounded-xl bg-dawn/20 p-4">
            <p>{c.newCodesReady}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => void generate()} className={primaryBtn}>
                {c.newCodesConfirm}
              </button>
              <button type="button" onClick={cancel} className={secondaryBtn}>
                {c.newCodesCancel}
              </button>
            </div>
          </div>
        ) : codes.kind !== "shown" ? (
          <p className="mt-4">
            <button ref={buttonRef} type="button" disabled={codes.kind === "working"} onClick={() => void generate()} className={secondaryBtn}>
              {codes.kind === "working" ? c.newCodesWorking : c.newCodes}
            </button>
          </p>
        ) : null}
        {/* The button pressed was disabled or removed, so focus goes to the error rather than <body>. */}
        {codes.kind === "error" && (codes.code === "reauth_required" && !me.identities.some((i) => i.provider === "github")
          ? <StatusNote focus>{c.nostrSignInAgain}</StatusNote>
          : <ErrorAlert lang={lang} code={codes.code} focus />)}
        {codes.kind === "done" && <StatusNote focus>{c.newCodesDone}</StatusNote>}
      </section>
      {codes.kind === "shown" && <RecoveryCodes lang={lang} codes={codes.codes} focusOnShow onContinue={() => setCodes({ kind: "done" })} />}

      <p className="mt-8">
        <SignOutLink lang={lang} />
      </p>
    </>
  );
}
