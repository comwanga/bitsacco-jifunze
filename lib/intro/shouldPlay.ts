export const INTRO_MS = 5200;

/** Shared by the pre-paint bootstrap and client-side mounts. No stored visit flag. */
export function startIntro(scene: HTMLElement): boolean {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  scene.classList.add("intro-play");
  return true;
}

export function introScript(): string {
  return `(${startIntro.toString()})(document.currentScript.parentElement);`;
}

/** One lifecycle for the existing CSS scene, scoped to the mounted homepage. */
export function playIntro(scene: HTMLElement): () => void {
  if (!startIntro(scene)) return () => {};
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const skip = () => scene.classList.add("intro-skip");
  const finish = () => {
    scene.classList.remove("intro-play", "intro-skip");
    window.removeEventListener("pointerdown", skip, { capture: true });
    window.removeEventListener("keydown", skip, { capture: true });
    motion.removeEventListener("change", finish);
  };
  window.addEventListener("pointerdown", skip, { capture: true });
  window.addEventListener("keydown", skip, { capture: true });
  motion.addEventListener("change", finish);
  const timer = window.setTimeout(finish, INTRO_MS);
  return () => { window.clearTimeout(timer); finish(); };
}
