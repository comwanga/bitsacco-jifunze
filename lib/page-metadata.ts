import type { Metadata } from "next";
import { LANGS, type Lang } from "./i18n";
import { SITE_URL } from "./site";

/** Each translation points to the same page in the other language, not its homepage. */
export function pageMetadata(lang: Lang, path: string, title: string, description?: string): Metadata {
  const url = `${SITE_URL}/${lang}/${path}`;
  return {
    title, description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(LANGS.map(l => [l, `${SITE_URL}/${l}/${path}`])),
    },
    openGraph: {
      title, description, url, type: "website", siteName: "Bitsacco Jifunze",
      locale: lang === "sw" ? "sw_KE" : "en_KE",
      alternateLocale: lang === "sw" ? "en_KE" : "sw_KE",
    },
  };
}
