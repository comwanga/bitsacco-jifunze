"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch, type ApiErrorCode, type ApiResult, githubStart, type Me } from "./api";
import { card, ErrorAlert, Loading, primaryBtn, RecoveryCodes, RetryError, secondaryBtn, SignedOutPrompt, SignOutLink, StatusNote, textLink } from "./parts";

type Load = { kind: "loading" } | { kind: "signedOut" } | { kind: "error"; code: ApiErrorCode } | { kind: "me"; me: Me };

function toLoad(res: ApiResult<Me>): Load {
  if (res.ok) return { kind: "me", me: res.data };
  return res.code === "unauthenticated" ? { kind: "signedOut" } : { kind: "error", code: res.code };
}
type Codes = { kind: "idle" } | { kind: "working" } | { kind: "shown"; codes: string[] } | { kind: "done" } | { kind: "error"; code: ApiErrorCode };
const AccountSecurity = lazy(() => import("./AccountSecurity"));

/** The restricted 15-minute session after a code: attach a new Nostr identity, or use retained GitHub compatibility. */
export function Recovery({ lang, recoveryLead }: { lang: Lang; recoveryLead: string }) {
  const c = accountCopy[lang];
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [codes, setCodes] = useState<Codes>({ kind: "idle" });
  const [recovered, setRecovered] = useState(false);

  // The first load starts in the loading state; a retry sets it again before asking.
  function retry() {
    setLoad({ kind: "loading" });
    void apiFetch<Me>("/api/me").then((res) => setLoad(toLoad(res)));
  }

  useEffect(() => {
    void apiFetch<Me>("/api/me").then((res) => setLoad(toLoad(res)));
  }, []);

  // From a recovery session the API always regenerates; there is no re-authentication step.
  async function generate() {
    setCodes({ kind: "working" });
    const res = await apiFetch<{ codes?: unknown }>("/api/me/recovery-codes", { method: "POST" });
    if (res.ok) {
      const list = Array.isArray(res.data?.codes) ? res.data.codes.filter((x): x is string => typeof x === "string") : [];
      setCodes(list.length ? { kind: "shown", codes: list } : { kind: "error", code: "internal" });
    } else if (res.code === "unauthenticated") setLoad({ kind: "signedOut" });
    else setCodes({ kind: "error", code: res.code });
  }

  if (load.kind === "loading") return <Loading lang={lang} />;
  if (load.kind === "signedOut") return <SignedOutPrompt lang={lang} />;
  if (load.kind === "error") return <RetryError lang={lang} code={load.code} onRetry={retry} />;

  const { me } = load;
  if (me.scope === "full") {
    return (
      <div className={`mt-6 ${card}`}>
        <p>{c.notInRecovery}</p>
        <p className="mt-3">
          <a href={`/${lang}/account/`} className={textLink}>
            {c.toAccount}
          </a>
        </p>
      </div>
    );
  }

  const github = me.identities.find((i) => i.provider === "github");
  if (me.identities.some((i) => i.provider === "nostr")) return <>
    {!recovered && <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{recoveryLead}</p>}
    <Suspense fallback={<Loading lang={lang} />}><AccountSecurity lang={lang} accountId={me.account.id} recovery onSessionEnded={() => setRecovered(true)} /></Suspense>
    {!recovered && <p className="mt-6"><SignOutLink lang={lang} /></p>}
  </>;
  return (
    <>
      <p className="mt-2 max-w-prose text-lg text-[var(--muted)]">{c.recoveryLead}</p>

      {github ? <section aria-labelledby="replace-heading" className={`mt-6 ${card}`}>
        <h2 id="replace-heading" className="text-xl font-bold">
          {c.replaceHeading}
        </h2>
        <p className="mt-2 text-[var(--muted)]">{c.replaceHelp}</p>
        {github?.handle && (
          <p className="mt-3">
            {c.linkedNow}: <span translate="no" className="font-mono">@{github.handle}</span>
          </p>
        )}
        <p className="mt-4">
          <a href={githubStart("replace", lang, `/${lang}/account/`)} className={primaryBtn}>
            {c.replaceGithub}
          </a>
        </p>
      </section> : <StatusNote>{c.error_nostr_lifecycle_pending}</StatusNote>}

      <section aria-labelledby="recovery-codes-heading" className={`mt-6 ${card}`}>
        <h2 id="recovery-codes-heading" className="text-xl font-bold">
          {c.codesSection}
        </h2>
        <p className="mt-2 text-[var(--muted)]">{c.recoveryCodesHelp}</p>
        {codes.kind !== "shown" && codes.kind !== "done" && (
          <p className="mt-4">
            <button type="button" disabled={codes.kind === "working"} onClick={() => void generate()} className={secondaryBtn}>
              {codes.kind === "working" ? c.newCodesWorking : c.newCodes}
            </button>
          </p>
        )}
        {codes.kind === "error" && <ErrorAlert lang={lang} code={codes.code} focus />}
        {codes.kind === "done" && <StatusNote focus>{c.newCodesDone}</StatusNote>}
      </section>
      {codes.kind === "shown" && <RecoveryCodes lang={lang} codes={codes.codes} focusOnShow onContinue={() => setCodes({ kind: "done" })} />}

      <p className="mt-8">
        <SignOutLink lang={lang} />
      </p>
    </>
  );
}
