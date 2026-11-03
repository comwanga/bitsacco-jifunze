import type { Lang } from "../i18n.ts";
import { CONTENT_ROOT, getLesson, getQuiz, listRoadmaps } from "./load.ts";
import type { CatalogEntry, LessonType } from "./catalog-filter.ts";

export { filterCatalog, type CatalogEntry, type LessonType } from "./catalog-filter.ts";

export function buildCatalog(lang: Lang, root: string = CONTENT_ROOT): CatalogEntry[] {
  return listRoadmaps(root).flatMap((r) => {
    let n = 0;
    return r.sections.flatMap((section) => section.lessons.map(({ slug }) => {
      const { frontmatter: fm, body, servedLang } = getLesson(r.id, slug, lang, root);
      const types: LessonType[] = ["reading"];
      if (getQuiz(r.id, slug, root)) types.push("quiz");
      if (/<Exercise\s/.test(body)) types.push("lab");
      return {
        roadmap: r.id, roadmapTitle: r.title[lang], section: section.title[lang], slug, n: ++n,
        title: fm.title, description: fm.description, level: fm.level, minutes: fm.minutes, types, contentLang: servedLang,
      };
    }));
  });
}
