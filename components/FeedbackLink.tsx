import type { Lang } from "@/lib/i18n";
import { FEEDBACK_EMAIL, feedbackCopy, feedbackHref, type FeedbackContext } from "@/lib/feedback";

/** Server-rendered mailto + native disclosure: works without JavaScript or clipboard permission. */
export function FeedbackLink({ lang, context, className = "" }: { lang: Lang; context?: FeedbackContext; className?: string }) {
  const c = feedbackCopy[lang];
  return <div data-feedback className={`relative flex flex-wrap items-center gap-x-2 text-[15px] ${className}`}>
    <a href={feedbackHref(lang, context)} className="inline-flex min-h-7 items-center underline underline-offset-4">{c.send}</a>
    <details>
      <summary role="button" aria-label={c.copy} title={c.copy} className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded border border-current/40">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 max-w-[80vw] rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 text-[var(--fg)] shadow-lg">
        <label className="block text-sm font-semibold">{c.email}<input readOnly value={FEEDBACK_EMAIL} autoComplete="off" spellCheck={false} className="mt-2 block w-full rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-base font-normal text-[var(--fg)]" /></label>
        <p className="mt-2 text-sm">{c.help}</p>
        <p className="mt-2 text-sm">{c.note}</p>
      </div>
    </details>
  </div>;
}
