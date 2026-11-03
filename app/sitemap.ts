import type { MetadataRoute } from "next";
import { flatLessons, listRoadmaps } from "@/lib/content/load";
import { LANGS } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "learn/", "library/", "glossary/", "progress/", "offline/",
    ...listRoadmaps().flatMap((r) => [
      `${r.id}/`, ...flatLessons(r).map((slug) => `${r.id}/${slug}/`),
    ]),
  ];
  return paths.flatMap((path) => LANGS.map((lang) => ({
    url: `${SITE_URL}/${lang}/${path}`,
    alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}/${l}/${path}`])) },
  })));
}
