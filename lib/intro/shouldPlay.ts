export const INTRO_MS = 5200;

/** One lifecycle for the existing CSS scene, scoped to the mounted homepage. */
export function playIntro(scene: HTMLElement): () => void {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches) return () => {};

  scene.classList.add("intro-play");
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
