export const UX_LIMITS = { home: 144.9, catalogue: 145, roadmap: 145.1, lesson: 147.3, lab: 153.2, tree: 145.1, simulation: 145, activated: 150, extra: 6 } as const;
export type UxPageKind = Exclude<keyof typeof UX_LIMITS, "activated" | "extra">;

export function uxPageKind(file: string, lab: boolean): UxPageKind | null {
  const p = file.replaceAll("\\", "/");
  if (!/^(sw|en)\//.test(p)) return null;
  const route = p.split("/").slice(1).join("/");
  if (route === "index.html") return "home";
  if (route === "learn/index.html") return "catalogue";
  if (route.startsWith("tree/")) return "tree";
  if (route.startsWith("list/")) return "roadmap";
  if (route.startsWith("simulations/")) return "simulation";
  if (/^(savers|builders|lightning)\/index.html$/.test(route)) return "roadmap";
  if (/^(savers|builders|lightning)\/.+\/index.html$/.test(route)) return lab ? "lab" : "lesson";
  return null;
}
