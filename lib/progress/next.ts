// What to read next, from on-device progress. Pure functions; safe for client bundles.
import type { RoadmapId } from "../content/schemas.ts";
import type { LessonKey, Progress } from "./model.ts";

export type PathOrder = { id: RoadmapId; slugs: string[] };
export type NextUp = { roadmap: RoadmapId; slug: string; reason: "continue" | "start" };

/** The most recent completion or quiz attempt, or null if there is none. */
export function lastActivity(p: Progress): { key: LessonKey; at: string } | null {
  let best: { key: LessonKey; at: string } | null = null;
  for (const [key, l] of Object.entries(p.lessons)) {
    for (const at of [l.completedAt, l.quiz?.at, l.reflectedAt]) {
      if (at && (!best || at > best.at)) best = { key: key as LessonKey, at };
    }
  }
  return best;
}

const isDone = (p: Progress, path: PathOrder, slug: string) => Boolean(p.lessons[`${path.id}/${slug}`]?.completedAt);

/** First lesson in the path not yet completed; null when the whole path is done. */
export function nextInPath(p: Progress, path: PathOrder): string | null {
  return path.slugs.find((s) => !isDone(p, path, s)) ?? null;
}

function upNext(p: Progress, path: PathOrder): NextUp | null {
  const slug = nextInPath(p, path);
  if (slug === null) return null;
  return { roadmap: path.id, slug, reason: path.slugs.some((s) => isDone(p, path, s)) ? "continue" : "start" };
}

/**
 * Where to pick up: the next lesson in the path of the latest activity.
 * If that path is finished, the first other unfinished path. Null before any activity, or when everything is done.
 */
export function continueLearning(p: Progress, paths: PathOrder[]): NextUp | null {
  const last = lastActivity(p);
  if (!last) return null;
  const [roadmap, slug] = last.key.split("/") as [RoadmapId, string];
  const current = paths.find((path) => path.id === roadmap && path.slugs.includes(slug));
  if (!current) return null;
  return upNext(p, current) ?? paths.map((path) => upNext(p, path)).find((n) => n !== null) ?? null;
}
