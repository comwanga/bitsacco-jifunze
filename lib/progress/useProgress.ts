"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  emptyProgress,
  markComplete,
  mergeProgress,
  parseProgressFile,
  recordLabPass,
  recordQuiz,
  type LessonKey,
  type ParseError,
  type Progress,
} from "./model.ts";
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

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function write(next: Progress): void {
  cache = next;
  if (!saveProgress(next, getStorage())) persistable = false;
  notify();
}

export function useProgress(): {
  progress: Progress;
  canPersist: boolean;
  complete(key: LessonKey): void;
  quiz(key: LessonKey, correct: number, total: number): void;
  importText(text: string): ParseError | null;
  labPass(key: LessonKey, exerciseId: string, allIds: string[]): void;
} {
  const progress = useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);
  const canPersist = useSyncExternalStore(subscribe, canPersistNow, () => true);

  const complete = useCallback((key: LessonKey) => write(markComplete(read(), key, new Date().toISOString())), []);
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
      write(recordLabPass(read(), key, exerciseId, allIds, new Date().toISOString())),
    [],
  );

  return { progress, canPersist, complete, quiz, importText, labPass };
}
