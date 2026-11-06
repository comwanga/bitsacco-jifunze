import Link from "next/link";
import type { Lang } from "@/lib/i18n";

export function AccountUnavailable({ lang }: { lang: Lang }) {
  const copy = lang === "sw" ? {
    title: "Jifunze bila akaunti",
    body: "Kuingia kwenye akaunti hakupatikani kwa sasa. Unaweza kujifunza na kuhifadhi maendeleo yako kwenye kifaa hiki bila akaunti.",
    learn: "Anza kujifunza",
  } : {
    title: "Learn without an account",
    body: "Sign-in is currently unavailable. You can learn and save your progress on this device without an account.",
    learn: "Start learning",
  };
  return <div data-account-unavailable className="mx-auto max-w-3xl px-4 pt-8 pb-16">
    <h1 className="text-3xl font-extrabold tracking-tight">{copy.title}</h1>
    <p className="mt-4 max-w-prose text-lg">{copy.body}</p>
    <Link href={`/${lang}/learn/`} className="mt-6 inline-block underline">{copy.learn}</Link>
  </div>;
}
