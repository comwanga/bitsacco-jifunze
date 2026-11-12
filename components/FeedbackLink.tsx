import type { Lang } from "@/lib/i18n";
import { feedbackCopy, feedbackHref, type FeedbackContext } from "@/lib/feedback";

/** A plain email link that works without JavaScript. */
export function FeedbackLink({ lang, context, className = "" }: { lang: Lang; context?: FeedbackContext; className?: string }) {
  const c = feedbackCopy[lang];
  return <div data-feedback className={`text-[15px] ${className}`}>
    <a href={feedbackHref(lang, context)} className="inline-flex min-h-7 items-center underline underline-offset-4">{c.send}</a>
  </div>;
}
