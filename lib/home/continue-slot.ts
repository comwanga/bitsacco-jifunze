/**
 * Runs before the first paint, inside the Continue slot: if this browser has saved progress, mark the slot so it
 * reserves room for the Continue card on small screens. The card hydrates into that room instead of pushing the
 * hero down (layout shift). Reads only the local progress record; nothing leaves the browser.
 */
export function reserveContinueSlot(slot: HTMLElement): void {
  try {
    const p = JSON.parse(localStorage.getItem("jifunze:progress:v1") || "null");
    if (p && p.lessons && Object.keys(p.lessons).length > 0) slot.setAttribute("data-reserved", "");
  } catch {
    // Blocked or corrupt storage: no reservation; the card (if any) appears as before.
  }
}

export function continueSlotScript(): string {
  return `(${reserveContinueSlot.toString()})(document.currentScript.parentElement);`;
}
