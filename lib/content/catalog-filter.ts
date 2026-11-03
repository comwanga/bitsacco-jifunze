import type { RoadmapId } from "./schemas.ts";

export type LessonType = "reading" | "quiz" | "lab";
export type CatalogEntry = {
  roadmap: RoadmapId;
  roadmapTitle: string;
  section: string;
  slug: string;
  n: number;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  minutes: number;
  types: LessonType[];
};

function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function filterCatalog(entries: CatalogEntry[], q: { text?: string; roadmap?: string; level?: string; type?: LessonType }): CatalogEntry[] {
  const needle = norm(q.text?.trim() ?? "");
  return entries.filter((e) =>
    (!needle || norm(`${e.title} ${e.description} ${e.section} ${e.slug}`).includes(needle)) &&
    (!q.roadmap || e.roadmap === q.roadmap) &&
    (!q.level || e.level === q.level) &&
    (!q.type || e.types.includes(q.type)),
  );
}
