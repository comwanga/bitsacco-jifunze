import { LANGS, type Lang } from "../i18n.ts";
import { flatLessons, getGlossary, getLesson, getRoadmap } from "./load.ts";
import type { RoadmapId } from "./schemas.ts";

export type SiteStats = { lessons: number; languages: number; hours: number; glossaryTerms: number };

/**
 * Counts for one learning path, computed from the repository content at build time. Never learner metrics.
 * `hours` sums the lessons' `minutes` estimates; the glossary is shared by every path.
 */
export function siteStats(lang: Lang, roadmapId: RoadmapId): SiteStats {
  const slugs = flatLessons(getRoadmap(roadmapId));
  const minutes = slugs.reduce((sum, slug) => sum + getLesson(roadmapId, slug, lang).frontmatter.minutes, 0);
  return { lessons: slugs.length, languages: LANGS.length, hours: Math.round(minutes / 60), glossaryTerms: getGlossary().length };
}
