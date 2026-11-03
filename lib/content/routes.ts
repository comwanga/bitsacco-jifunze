import { CONTENT_ROOT, flatLessons, listRoadmaps } from "./load.ts";
import { SIMULATIONS } from "../simulations/registry.ts";

/** Language-relative static pages, shared by metadata and build/browser assertions. */
export function sitePaths(root = CONTENT_ROOT): string[] {
  return ["", "learn/", "library/", "glossary/", "progress/", "offline/",
    ...listRoadmaps(root).flatMap((r) => [`${r.id}/`, `tree/${r.id}/`, ...flatLessons(r).map((slug) => `${r.id}/${slug}/`)]),
    "simulations/", ...SIMULATIONS.map((s) => `simulations/${s.id}/`),
  ];
}

/** Pages a search engine should list: everything except the noindex offline fallbacks. */
export function indexablePaths(root = CONTENT_ROOT): string[] {
  return sitePaths(root).filter((p) => p !== "offline/");
}
