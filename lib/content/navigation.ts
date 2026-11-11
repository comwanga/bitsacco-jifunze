import type { Roadmap } from "./schemas.ts";
import type { PathOrder } from "../progress/next.ts";

/** Keep optional specializations separate while preserving the original introductory sequence. */
export function readingSequence(roadmap: Roadmap, slug: string): string[] {
  const section = roadmap.sections.find((s) => s.lessons.some((l) => l.slug === slug));
  return (section?.optional ? [section] : roadmap.sections.filter((s) => !s.optional))
    .flatMap((s) => s.lessons.map((l) => l.slug));
}

export function pathOrder(roadmap: Roadmap): PathOrder {
  const optionalSections = roadmap.sections.filter((s) => s.optional).map((s) => s.lessons.map((l) => l.slug));
  return {
    id: roadmap.id,
    slugs: roadmap.sections.flatMap((s) => s.lessons.map((l) => l.slug)),
    ...(optionalSections.length ? { optionalSections } : {}),
  };
}
