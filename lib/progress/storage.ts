import { emptyProgress, parseProgressFile, type Progress } from "./model.ts";

export const STORAGE_KEY = "jifunze:progress:v1";

export function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = "jifunze:probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function loadProgress(storage: Storage | null): Progress {
  if (!storage) return emptyProgress();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = parseProgressFile(raw);
    return parsed.ok ? parsed.progress : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress, storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
