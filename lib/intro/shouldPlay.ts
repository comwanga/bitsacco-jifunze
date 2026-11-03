export const INTRO_KEY = "jifunze:intro-seen";
export const INTRO_MS = 5200;

export function shouldPlayIntro(o: { seen: boolean; reducedMotion: boolean }): boolean {
  return !o.seen && !o.reducedMotion;
}

/**
 * Inline script placed just before the hero so it runs before first paint.
 * It only adds classes to <html>; the scene's default (no class) is the final frame,
 * so returning visitors, reduced motion and no-JS all see the grown tree.
 */
export function introScript(): string {
  return `(function(){var d=document.documentElement;try{
var seen=localStorage.getItem(${JSON.stringify(INTRO_KEY)})==="1";
var rm=!!(typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches);
if(!(${shouldPlayIntro.toString()})({seen:seen,reducedMotion:rm}))return;
d.classList.add("intro-play");localStorage.setItem(${JSON.stringify(INTRO_KEY)},"1");
var off=function(){removeEventListener("pointerdown",skip,true);removeEventListener("keydown",skip,true)};
var skip=function(){d.classList.add("intro-skip");off()};
addEventListener("pointerdown",skip,true);addEventListener("keydown",skip,true);
setTimeout(function(){off();d.classList.remove("intro-play");d.classList.remove("intro-skip")},${INTRO_MS});
}catch(e){}})();`;
}
