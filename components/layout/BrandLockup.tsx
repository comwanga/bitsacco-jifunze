import Link from "next/link";
import { siteCopy } from "@/lib/site-copy";
import type { Lang } from "@/lib/i18n";
import { BitsaccoLogo } from "./BitsaccoLogo";

/** The Bitsacco mark with "Jifunze" and a small "by Bitsacco": one identity, used in the header and footer. */
/** The footer copy passes prefetch={false}: on short pages it is on screen at load, and the home page should not be fetched for it. */
export function BrandLockup({ lang, size = "md", prefetch }: { lang: Lang; size?: "md" | "lg"; prefetch?: false }) {
  const mark = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const name = size === "lg" ? "text-2xl" : "text-[1.35rem]";
  return (
    <Link href={`/${lang}/`} prefetch={prefetch} data-brand className="flex shrink-0 items-center gap-2.5 rounded-lg text-white">
      <BitsaccoLogo mark className={`${mark} shrink-0 text-teal-200`} />
      <span className="flex flex-col">
        <span className={`${name} leading-none font-extrabold tracking-tight`}>Jifunze</span>
        <span className="mt-1 text-[11px] leading-none font-medium text-teal-100/80">{siteCopy[lang].brandBy}</span>
      </span>
    </Link>
  );
}
