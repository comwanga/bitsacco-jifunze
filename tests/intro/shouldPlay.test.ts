import { afterEach, describe, expect, test, vi } from "vitest";
import { INTRO_MS, introScript, playIntro } from "../../lib/intro/shouldPlay.ts";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function setup(reducedMotion = false) {
  vi.useFakeTimers();
  const classes = new Set<string>();
  const scene = { classList: {
    add: (...names: string[]) => names.forEach((n) => classes.add(n)),
    remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
  } } as unknown as HTMLElement;
  const motion = Object.assign(new EventTarget(), { matches: reducedMotion });
  const events = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
  vi.stubGlobal("window", events);
  vi.stubGlobal("matchMedia", () => motion);
  vi.stubGlobal("localStorage", { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
  return { classes, scene, motion, events };
}

describe("homepage intro lifecycle", () => {
  test("the pre-paint script uses the same start logic, without storage", () => {
    for (const reducedMotion of [false, true]) {
      const { classes, scene } = setup(reducedMotion);
      new Function("document", introScript())({ currentScript: { parentElement: scene } });
      expect(classes.has("intro-play")).toBe(!reducedMotion);
    }
  });
  test("plays on every mount even when storage is unavailable", () => {
    const { classes, scene } = setup();
    for (let visit = 0; visit < 3; visit++) {
      const cleanup = playIntro(scene);
      expect(classes.has("intro-play")).toBe(true);
      cleanup();
      expect(classes.size).toBe(0);
    }
  });
  test("skips on input and removes listeners and timer on unmount", () => {
    const { classes, scene, events } = setup();
    const cleanup = playIntro(scene);
    events.dispatchEvent(new Event("keydown"));
    expect(classes.has("intro-skip")).toBe(true);
    cleanup();
    events.dispatchEvent(new Event("pointerdown"));
    expect(classes.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  test("settles at the end without leaving input listeners behind", () => {
    const { classes, scene, events } = setup();
    playIntro(scene);
    vi.advanceTimersByTime(INTRO_MS);
    events.dispatchEvent(new Event("pointerdown"));
    expect(classes.size).toBe(0);
  });
  test("skips for reduced motion and stops when the preference changes", () => {
    const reduced = setup(true);
    playIntro(reduced.scene);
    expect(reduced.classes.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    const active = setup();
    playIntro(active.scene);
    active.motion.dispatchEvent(new Event("change"));
    expect(active.classes.size).toBe(0);
  });
});
