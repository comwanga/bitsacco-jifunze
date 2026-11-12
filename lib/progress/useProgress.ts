"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  emptyProgress,
  markComplete,
  mergeProgress,
  parseProgressFile,
  recordLabPass,
  recordQuiz,
  recordReflection,
  type LessonKey,
  type ParseError,
  type Progress,
} from "./model.ts";
import { ACCOUNT_KEY, DIRTY_KEY, STATUS_KEY } from "./keys.ts";
import { getStorage, loadProgress, saveProgress, STORAGE_KEY } from "./storage.ts";

const SERVER_SNAPSHOT: Progress = emptyProgress();
const listeners = new Set<() => void>();
let cache: Progress | null = null;
let persistable: boolean | null = null;

function read(): Progress {
  if (cache === null) cache = loadProgress(getStorage());
  return cache;
}

function canPersistNow(): boolean {
  if (persistable === null) persistable = getStorage() !== null;
  return persistable;
}

function notify(): void {
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent): void {
  if (e.key === null || e.key === STORAGE_KEY) {
    cache = null;
    notify();
  }
}

/**
 * Signed-in learners only: notes unsent work, then loads the sync code. Without the sign-in marker this returns
 * at once, so an anonymous learner never downloads that code and never calls the account service.
 */
function syncSoon(wrote: boolean): void {
  try {
    const storage = getStorage();
    if (!storage?.getItem(ACCOUNT_KEY)) {
      if (storage?.getItem(STATUS_KEY) === "expired") void import("./sync.ts").then((m) => m.showStatus()).catch(() => {});
      return;
    }
    if (wrote) storage.setItem(DIRTY_KEY, "1");
  } catch {
    return;
  }
  void import("./sync.ts").then((m) => m.requestSync(wrote)).catch(() => {});
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    syncSoon(false);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function write(next: Progress): void {
  const storage = getStorage();
  // Another tab may have written before its asynchronous storage event reached this tab.
  // Merge the latest persisted snapshot before replacing it; retain in-memory work if storage is unavailable.
  cache = mergeProgress(loadProgress(storage), next);
  if (!saveProgress(cache, storage)) persistable = false;
  notify();
  syncSoon(true);
}

export function useProgress(): {
  progress: Progress;
  canPersist: boolean;
  complete(key: LessonKey): void;
  reflect(key: LessonKey): void;
  quiz(key: LessonKey, correct: number, total: number): void;
  importText(text: string): ParseError | null;
  labPass(key: LessonKey, exerciseId: string, allIds: string[]): void;
} {
  const progress = useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);
  const canPersist = useSyncExternalStore(subscribe, canPersistNow, () => true);

  const complete = useCallback((key: LessonKey) => {
    const current = read();
    if (current.lessons[key]?.reflectedAt || current.lessons[key]?.completedAt) write(markComplete(current, key, new Date().toISOString()));
  }, []);
  const reflect = useCallback((key: LessonKey) => write(recordReflection(read(), key, new Date().toISOString())), []);
  const quiz = useCallback(
    (key: LessonKey, correct: number, total: number) =>
      write(recordQuiz(read(), key, correct, total, new Date().toISOString())),
    [],
  );
  const importText = useCallback((text: string): ParseError | null => {
    const parsed = parseProgressFile(text);
    if (!parsed.ok) return parsed.error;
    write(mergeProgress(read(), parsed.progress));
    return null;
  }, []);

  const labPass = useCallback(
    (key: LessonKey, exerciseId: string, allIds: string[]) =>
      write(recordLabPass(read(), key, exerciseId, allIds, new Date().toISOString(), true)),
    [],
  );

  return { progress, canPersist, complete, reflect, quiz, importText, labPass };
}
