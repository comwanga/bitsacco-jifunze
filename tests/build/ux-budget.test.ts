import { expect, test } from "vitest";
import { uxPageKind, UX_LIMITS } from "../../lib/build/ux-budget.ts";

test("classifies every scoped route without confusing tree, lesson and live lab budgets", () => {
  for (const lang of ["sw", "en"]) {
    for (const [route, kind, lab] of [
      ["index.html", "home", false], ["learn/index.html", "catalogue", false],
      ["savers/index.html", "roadmap", false], ["tree/builders/index.html", "tree", false],
      ["list/builders/index.html", "roadmap", false],
      ["builders/utxos-transactions/index.html", "lesson", false],
      ["lightning/payment-channels/index.html", "lab", true],
      ["simulations/index.html", "simulation", false], ["simulations/utxo/index.html", "simulation", false],
    ] as const) expect(uxPageKind(`${lang}/${route}`, lab)).toBe(kind);
  }
  expect(uxPageKind("404.html", false)).toBeNull();
  expect(UX_LIMITS).toEqual({ home: 144.9, catalogue: 145, roadmap: 145.1, lesson: 147.3, lab: 153.2, tree: 145.1, simulation: 145, activated: 150, extra: 6 });
});
