import { describe, expect, test } from "vitest";
import { emptyProgress, markComplete } from "../../lib/progress/model.ts";
import { loadProgress, saveProgress, STORAGE_KEY } from "../../lib/progress/storage.ts";

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

class ThrowingStorage extends MemoryStorage {
  setItem(): void { throw new DOMException("quota", "QuotaExceededError"); }
  getItem(): string | null { throw new DOMException("denied", "SecurityError"); }
}

describe("progress storage", () => {
  test("saves and loads", () => {
    const s = new MemoryStorage();
    const p = markComplete(emptyProgress(), "savers/a", "2026-11-01T00:00:00.000Z");
    expect(saveProgress(p, s)).toBe(true);
    expect(loadProgress(s)).toEqual(p);
    expect(s.getItem(STORAGE_KEY)).toContain("savers/a");
  });
  test("returns false instead of throwing when storage fails", () => {
    expect(saveProgress(emptyProgress(), new ThrowingStorage())).toBe(false);
  });
  test("falls back to empty progress on garbage, missing or throwing storage", () => {
    const s = new MemoryStorage();
    s.setItem(STORAGE_KEY, "garbage{");
    expect(loadProgress(s)).toEqual(emptyProgress());
    expect(loadProgress(null)).toEqual(emptyProgress());
    expect(loadProgress(new ThrowingStorage())).toEqual(emptyProgress());
    expect(saveProgress(emptyProgress(), null)).toBe(false);
  });
});
