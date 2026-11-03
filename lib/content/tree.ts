import type { Lang } from "../i18n.ts";
import { buildCatalog, type CatalogEntry } from "./catalog.ts";
import { CONTENT_ROOT, getRoadmap, listRoadmaps, flatLessons } from "./load.ts";
import { ROADMAP_IDS, type RoadmapId } from "./schemas.ts";
import type { SimulationEntry } from "../simulations/registry.ts";

export type TreeLesson = CatalogEntry & { prerequisites: { slug: string; title: string }[] };
export type TreeSection = { id: string; title: string; lessons: TreeLesson[] };
export type TreePath = { id: RoadmapId; title: string; tagline: string; description: string; sections: TreeSection[] };

export function buildTree(lang: Lang, id: string, root = CONTENT_ROOT): TreePath {
  if (!(ROADMAP_IDS as readonly string[]).includes(id)) throw new Error(`Unknown roadmap: ${id}`);
  const r = getRoadmap(id as RoadmapId, root);
  const entries = new Map(buildCatalog(lang, root).filter((l) => l.roadmap === id).map((l) => [l.slug, l]));
  return { id: r.id, title: r.title[lang], tagline: r.tagline[lang], description: r.description[lang],
    sections: r.sections.map((s) => ({ id: s.id, title: s.title[lang], lessons: s.lessons.map((l) => ({
      ...entries.get(l.slug)!, prerequisites: (l.prerequisites ?? []).map((slug) => {
        const p = entries.get(slug);
        if (!p) throw new Error(`Unknown prerequisite: ${id}/${slug}`);
        return { slug, title: p.title };
      }),
    })) })),
  };
}

export function validateSimulationLessons(entries: SimulationEntry[], root = CONTENT_ROOT): void {
  const keys = new Set(listRoadmaps(root).flatMap((r) => flatLessons(r).map((s) => `${r.id}/${s}`)));
  for (const entry of entries) for (const key of entry.lessons) if (!keys.has(key)) throw new Error(`Unknown lesson: ${key}`);
}
