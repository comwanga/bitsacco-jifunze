import { LANGS, type Lang } from "../i18n.ts";
import { flatLessons, getGlossary, getLesson, listRoadmaps } from "./load.ts";

export type SiteStats = { lessons: number; languages: number; hours: number; glossaryTerms: number };

/** Counts computed from the repository content at build time. Never learner metrics. */
export function siteStats(lang: Lang): SiteStats {
  let lessons = 0;
  let minutes = 0;
  for (const roadmap of listRoadmaps())
    for (const slug of flatLessons(roadmap)) {
      lessons += 1;
      minutes += getLesson(roadmap.id, slug, lang).frontmatter.minutes;
    }
  return { lessons, languages: LANGS.length, hours: Math.round(minutes / 60), glossaryTerms: getGlossary().length };
}
