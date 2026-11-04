"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { accountCopy, errorText } from "@/lib/account-copy";
import type { Lang } from "@/lib/i18n";

// Shared pieces of the account islands, in the site's existing button and message styles.
export const primaryBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-teal-700 px-5 py-2.5 text-center font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full border-2 border-teal-600 px-5 py-2 text-center font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-400 dark:hover:bg-teal-900/30";
export const textLink = "font-semibold text-teal-700 underline underline-offset-4 dark:text-teal-400";
export const card = "rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5";

const errorBox = "rounded-xl bg-[#fff0e8] p-4 text-[#6b2203] dark:bg-[#3d1a0c] dark:text-[#ffd9c4]";
const okBox = "rounded-xl bg-teal-50 p-4 text-teal-900 dark:bg-teal-900/30 dark:text-teal-50";

/** A localized error, announced as it appears. `focus` moves focus to it, for an error that replaces the control just used. */
export function ErrorAlert({ lang, code, children, focus = false }: { lang: Lang; code: string; children?: ReactNode; focus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div ref={ref} role="alert" tabIndex={focus ? -1 : undefined} className={`mt-6 ${errorBox}`}>
      <p>{errorText(lang, code)}</p>
      {children}
    </div>
  );
}

/** A success or progress message, announced politely. tabIndex lets an island move focus to it after an action. */
export function StatusNote({ children, focus = false }: { children: ReactNode; focus?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <p ref={ref} role="status" tabIndex={-1} className={`mt-6 ${okBox}`}>
      {children}
    </p>
  );
}

export function Loading({ lang }: { lang: Lang }) {
  return (
    <p role="status" className="mt-6 text-[var(--muted)]">
      {accountCopy[lang].loading}
    </p>
  );
}

/** What every island shows when /api/me (or another call) answers 401. */
export function SignedOutPrompt({ lang }: { lang: Lang }) {
  const c = accountCopy[lang];
  return (
    <div className={`mt-6 ${card}`}>
      <p className="font-semibold">{c.signedOut}</p>
      <p className="mt-2 text-[var(--muted)]">{c.optional}</p>
      <p className="mt-4">
        <a href={`/${lang}/account/signin/`} className={primaryBtn}>
          {c.signInLink}
        </a>
      </p>
    </div>
  );
}

/** A failed request with a way to try again (network failure, or an error the reader can retry). */
export function RetryError({ lang, code, onRetry }: { lang: Lang; code: string; onRetry: () => void }) {
  return (
    <ErrorAlert lang={lang} code={code}>
      <button type="button" onClick={onRetry} className={`mt-3 ${secondaryBtn}`}>
        {accountCopy[lang].retry}
      </button>
    </ErrorAlert>
  );
}

export function SignOutLink({ lang }: { lang: Lang }) {
  return (
    <a href={`/${lang}/account/signout/`} className={secondaryBtn}>
      {accountCopy[lang].signOut}
    </a>
  );
}

/**
 * Recovery codes, shown once: a monospace list, Copy and Download (.txt), and a required "I've saved them"
 * tick before Continue. Used by welcome and by both "new codes" flows.
 */
export function RecoveryCodes({ lang, codes, focusOnShow, onContinue }: { lang: Lang; codes: string[]; focusOnShow: boolean; onContinue: () => void }) {
  const c = accountCopy[lang];
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "failed">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnShow) headingRef.current?.focus();
  }, [focusOnShow]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopyState("ok");
    } catch {
      setCopyState("failed");
    }
  }

  function download() {
    const text = `${c.fileTitle}\n${c.fileNote}\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "jifunze-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-labelledby="codes-heading" data-recovery-codes className={`mt-6 ${card}`}>
      <h2 id="codes-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold">
        {c.codesHeading}
      </h2>
      <p className="mt-2 text-[var(--muted)]">{c.codesOnce}</p>
      <ol translate="no" className="mt-4 grid gap-2 font-mono text-base sm:grid-cols-2" data-codes>
        {codes.map((code) => (
          <li key={code} className="rounded-lg bg-[var(--line)] px-3 py-2 tracking-wider break-all">
            {code}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={copy} className={secondaryBtn}>
          {c.copyCodes}
        </button>
        <button type="button" onClick={download} className={secondaryBtn}>
          {c.downloadCodes}
        </button>
      </div>
      <p role="status" className="mt-2 min-h-6 text-sm text-[var(--muted)]">
        {copyState === "ok" ? c.copied : copyState === "failed" ? c.copyFailed : ""}
      </p>
      <div className="mt-4 flex items-start gap-3">
        <input
          id="codes-saved"
          type="checkbox"
          required
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          aria-describedby="codes-saved-hint"
          className="mt-1 h-5 w-5 shrink-0 accent-teal-700"
        />
        <div>
          <label htmlFor="codes-saved" className="font-semibold">
            {c.savedConfirm}
          </label>
          <p id="codes-saved-hint" className="text-sm text-[var(--muted)]">
            {c.savedHint}
          </p>
        </div>
      </div>
      <p className="mt-4">
        <button type="button" disabled={!saved} onClick={onContinue} className={primaryBtn}>
          {c.continue}
        </button>
      </p>
    </section>
  );
}
