import type { Lang } from "../i18n.ts";
import type { Roadmap } from "./schemas.ts";

export type PathIntroCopy = { outcomes: string[]; format: string; audience: string };

/** The path's "what you'll learn / how it works / who it's for" copy in one language, or null when the path has none. */
export function pathIntro(roadmap: Roadmap, lang: Lang): PathIntroCopy | null {
  const { outcomes, format, audience } = roadmap;
  if (!outcomes || !format || !audience) return null;
  return { outcomes: outcomes.map((o) => o[lang]), format: format[lang], audience: audience[lang] };
}
