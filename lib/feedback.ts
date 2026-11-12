import { SITE_URL } from "./site";
import type { Lang } from "./i18n";

// Public build-time configuration. It appears in mailto links.
export function feedbackRecipient(value: string | undefined): string {
  const email = value || "mwanga@bitsacco.com";
  if (email.length > 254 || !/^[A-Za-z0-9._+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(email)) {
    throw new Error("JIFUNZE_FEEDBACK_EMAIL must be one plain email address");
  }
  return email;
}

export const FEEDBACK_EMAIL = feedbackRecipient(process.env.JIFUNZE_FEEDBACK_EMAIL);
export type FeedbackContext = { pathTitle: string; lessonTitle?: string; pathname: string };

export const feedbackCopy = {
  en: { send: "Send Feedback" },
  sw: { send: "Tuma Maoni" },
} satisfies Record<Lang, Record<string, string>>;

const plain = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, " ").trim();

/** Only build-time curriculum context belongs here. Never read location, storage, cookies or learner state. */
export function feedbackHref(lang: Lang, context?: FeedbackContext): string {
  if (context && (!/^\/(en|sw)\/(savers|builders|lightning)\/(?:[a-z0-9-]+\/)?$/.test(context.pathname) || !context.pathname.startsWith(`/${lang}/`))) {
    throw new Error("Feedback context must be a public learning path or lesson path without query or fragment");
  }
  const c = feedbackCopy[lang];
  const subject = `Bitsacco Jifunze: ${c.send}${context ? ` — ${plain(context.lessonTitle ?? context.pathTitle)}` : ""}`;
  const body = context ? [
    plain(context.pathTitle),
    ...(context.lessonTitle ? [plain(context.lessonTitle)] : []),
    `${SITE_URL}${context.pathname}`,
  ].join("\n") : "";
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
