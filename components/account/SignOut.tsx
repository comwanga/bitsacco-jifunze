"use client";

import { useEffect, useRef, useState } from "react";
import { accountCopy } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";
import { apiFetch } from "./api";
import { primaryBtn, RetryError, StatusNote, textLink } from "./parts";

type State = { kind: "working" } | { kind: "done" } | { kind: "error"; code: string };

/** Signs out with a fetch POST (never a form: the CSP has form-action 'none'), then says so. */
export function SignOut({ lang }: { lang: Lang }) {
  const c = accountCopy[lang];
  const [state, setState] = useState<State>({ kind: "working" });
  const started = useRef(false);
  const [retried, setRetried] = useState(false);

  async function signOut() {
    setState({ kind: "working" });
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    // 401: there was no session to end, which is the outcome the reader asked for.
    if (res.ok || res.code === "unauthenticated") setState({ kind: "done" });
    else setState({ kind: "error", code: res.code });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void signOut();
  }, []);

  if (state.kind === "working") return <p role="status" className="mt-6 text-[var(--muted)]">{c.signingOut}</p>;
  if (state.kind === "error") {
    return (
      <RetryError
        lang={lang}
        code={state.code}
        onRetry={() => {
          setRetried(true);
          void signOut();
        }}
      />
    );
  }
  return (
    <>
      {/* After a retry the reader's focus was on the button that just went away, so move it to the result. */}
      <StatusNote focus={retried}>{c.signedOutDone}</StatusNote>
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
