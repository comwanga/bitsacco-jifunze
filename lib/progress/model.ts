// On-device progress. Pure functions only; no zod here to keep client JS small.
import type { RoadmapId } from "../content/schemas.ts";

export const APP_ID = "bitsacco-jifunze";
export const PROGRESS_VERSION = 1;

export type LessonKey = `${RoadmapId}/${string}`;
export type QuizScore = { correct: number; total: number; at: string };
export type LabProgress = { passed: string[] };
export type LessonProgress = { completedAt?: string; reflectedAt?: string; quiz?: QuizScore; lab?: LabProgress };
export type Progress = { app: typeof APP_ID; version: typeof PROGRESS_VERSION; lessons: Record<string, LessonProgress> };
export type ParseError = "invalid-json" | "wrong-app" | "unsupported-version" | "invalid-shape";

export function emptyProgress(): Progress {
  return { app: APP_ID, version: PROGRESS_VERSION, lessons: {} };
}

export function lessonKey(roadmap: RoadmapId, slug: string): LessonKey {
  return `${roadmap}/${slug}`;
}

function withLesson(p: Progress, key: string, next: LessonProgress): Progress {
  return { ...p, lessons: { ...p.lessons, [key]: next } };
}

export function markComplete(p: Progress, key: LessonKey, now: string): Progress {
  const current = p.lessons[key] ?? {};
  if (current.completedAt) return p;
  return withLesson(p, key, { ...current, completedAt: now });
}

/** Self-attestation only: written/discussed answers remain with the learner, never in browser storage. */
export function recordReflection(p: Progress, key: LessonKey, now: string): Progress {
  const current = p.lessons[key] ?? {};
  return current.reflectedAt ? p : withLesson(p, key, { ...current, reflectedAt: now });
}

function better(a: QuizScore | undefined, b: QuizScore | undefined): QuizScore | undefined {
  if (!a) return b;
  if (!b) return a;
  const ra = a.total > 0 ? a.correct / a.total : 0;
  const rb = b.total > 0 ? b.correct / b.total : 0;
  if (rb > ra) return b;
  if (ra > rb) return a;
  return a.at <= b.at ? a : b;
}

export function recordQuiz(p: Progress, key: LessonKey, correct: number, total: number, now: string): Progress {
  const current = p.lessons[key] ?? {};
  const best = better(current.quiz, { correct, total, at: now });
  return withLesson(p, key, { ...current, quiz: best });
}

/** Record that a lab exercise passed; the lesson counts as complete once all its exercises pass. */
export function recordLabPass(p: Progress, key: LessonKey, exerciseId: string, allIds: string[], now: string, requiresReflection = false): Progress {
  const current = p.lessons[key] ?? {};
  const passed = current.lab?.passed ?? [];
  const nextPassed = passed.includes(exerciseId) ? passed : [...passed, exerciseId];
  const next: LessonProgress = { ...current, lab: { passed: nextPassed } };
  if (!next.completedAt && (!requiresReflection || next.reflectedAt) && allIds.length > 0 && allIds.every((id) => nextPassed.includes(id))) next.completedAt = now;
  if (nextPassed === passed && next.completedAt === current.completedAt) return p;
  return withLesson(p, key, next);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isLessonProgress(v: unknown): v is LessonProgress {
  if (!isObject(v)) return false;
  if (v.completedAt !== undefined && typeof v.completedAt !== "string") return false;
  if (v.reflectedAt !== undefined && (typeof v.reflectedAt !== "string" || !v.reflectedAt)) return false;
  if (v.quiz !== undefined) {
    const q = v.quiz;
    if (!isObject(q)) return false;
    if (!Number.isInteger(q.correct) || !Number.isInteger(q.total) || typeof q.at !== "string") return false;
    if ((q.correct as number) < 0 || (q.total as number) < (q.correct as number)) return false;
  }
  if (v.lab !== undefined) {
    if (!isObject(v.lab) || !Array.isArray(v.lab.passed)) return false;
    if (!v.lab.passed.every((id) => typeof id === "string" && id.length <= 64)) return false;
  }
  return true;
}

export function parseProgressFile(text: string): { ok: true; progress: Progress } | { ok: false; error: ParseError } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid-json" };
  }
  if (!isObject(data)) return { ok: false, error: "invalid-shape" };
  if (data.app !== APP_ID) return { ok: false, error: "wrong-app" };
  if (data.version !== PROGRESS_VERSION) return { ok: false, error: "unsupported-version" };
  if (!isObject(data.lessons)) return { ok: false, error: "invalid-shape" };
  const lessons: Record<string, LessonProgress> = {};
  for (const [key, value] of Object.entries(data.lessons)) {
    if (!/^(savers|builders|lightning)\/[a-z0-9-]+$/.test(key) || !isLessonProgress(value)) {
      return { ok: false, error: "invalid-shape" };
    }
    const entry: LessonProgress = {};
    if (value.completedAt) entry.completedAt = value.completedAt;
    if (value.reflectedAt) entry.reflectedAt = value.reflectedAt;
    if (value.quiz) entry.quiz = { correct: value.quiz.correct, total: value.quiz.total, at: value.quiz.at };
    if (value.lab) entry.lab = { passed: [...new Set(value.lab.passed)] };
    lessons[key] = entry;
  }
  return { ok: true, progress: { app: APP_ID, version: PROGRESS_VERSION, lessons } };
}

export function mergeProgress(current: Progress, incoming: Progress): Progress {
  const lessons: Record<string, LessonProgress> = { ...current.lessons };
  for (const [key, inc] of Object.entries(incoming.lessons)) {
    const cur = lessons[key] ?? {};
    const completedAt =
      cur.completedAt && inc.completedAt
        ? cur.completedAt <= inc.completedAt
          ? cur.completedAt
          : inc.completedAt
        : (cur.completedAt ?? inc.completedAt);
    const quiz = better(cur.quiz, inc.quiz);
    const merged: LessonProgress = {};
    if (completedAt) merged.completedAt = completedAt;
    const reflectedAt = cur.reflectedAt && inc.reflectedAt ? (cur.reflectedAt <= inc.reflectedAt ? cur.reflectedAt : inc.reflectedAt) : cur.reflectedAt ?? inc.reflectedAt;
    if (reflectedAt) merged.reflectedAt = reflectedAt;
    if (quiz) merged.quiz = quiz;
    const passed = [...new Set([...(cur.lab?.passed ?? []), ...(inc.lab?.passed ?? [])])];
    if (passed.length) merged.lab = { passed };
    lessons[key] = merged;
  }
  return { ...current, lessons };
}

export function serializeProgress(p: Progress, now: string): string {
  return JSON.stringify({ ...p, exportedAt: now }, null, 2);
}

export function exportFilename(now: string): string {
  return `jifunze-maendeleo-${now.slice(0, 10)}.json`;
}
