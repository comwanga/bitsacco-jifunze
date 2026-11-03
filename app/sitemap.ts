import type { MetadataRoute } from "next";
import { indexablePaths } from "@/lib/content/routes";
import { LANGS } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths().flatMap((path) => LANGS.map((lang) => ({
    url: `${SITE_URL}/${lang}/${path}`,
    alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}/${l}/${path}`])) },
  })));
}
