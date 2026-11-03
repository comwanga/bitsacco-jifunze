import { describe, expect, test } from "vitest";
import { INTRO_KEY, introScript, shouldPlayIntro } from "../../lib/intro/shouldPlay.ts";

describe("shouldPlayIntro", () => {
  test("plays on a first visit", () => {
    expect(shouldPlayIntro({ seen: false, reducedMotion: false })).toBe(true);
  });
  test("does not replay for returning visitors", () => {
    expect(shouldPlayIntro({ seen: true, reducedMotion: false })).toBe(false);
  });
  test("does not play when reduced motion is requested", () => {
    expect(shouldPlayIntro({ seen: false, reducedMotion: true })).toBe(false);
  });
});

function run(opts: { seen: boolean; reducedMotion: boolean; storageThrows?: boolean }) {
  const classes = new Set<string>();
  const store = new Map<string, string>(opts.seen ? [[INTRO_KEY, "1"]] : []);
  const listeners: Record<string, () => void> = {};
  const timers: (() => void)[] = [];
  const document = { documentElement: { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } } };
  const localStorage = {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new Error("denied");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => store.set(k, v),
  };
  const matchMedia = () => ({ matches: opts.reducedMotion });
  const addEventListener = (type: string, fn: () => void) => (listeners[type] = fn);
  const removeEventListener = (type: string) => delete listeners[type];
  const setTimeout = (fn: () => void) => timers.push(fn);
  new Function("document", "localStorage", "matchMedia", "addEventListener", "removeEventListener", "setTimeout", introScript())(
    document, localStorage, matchMedia, addEventListener, removeEventListener, setTimeout,
  );
  return { classes, store, listeners, timers };
}

describe("introScript (the inline pre-paint script)", () => {
  test("first visit: adds intro-play and remembers the visit", () => {
    const r = run({ seen: false, reducedMotion: false });
    expect(r.classes.has("intro-play")).toBe(true);
    expect(r.store.get(INTRO_KEY)).toBe("1");
  });
  test("any tap or key press skips to the final frame", () => {
    const r = run({ seen: false, reducedMotion: false });
    r.listeners.pointerdown();
    expect(r.classes.has("intro-skip")).toBe(true);
  });
  test("after the sequence ends the play class is removed so later visits to home don't replay", () => {
    const r = run({ seen: false, reducedMotion: false });
    r.timers.forEach((fn) => fn());
    expect(r.classes.has("intro-play")).toBe(false);
  });
  test("returning visitor, reduced motion or blocked storage: no animation", () => {
    expect(run({ seen: true, reducedMotion: false }).classes.size).toBe(0);
    expect(run({ seen: false, reducedMotion: true }).classes.size).toBe(0);
    expect(run({ seen: false, reducedMotion: false, storageThrows: true }).classes.size).toBe(0);
  });
});
