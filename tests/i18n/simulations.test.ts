import { expect, test } from "vitest";
import { simulationCopy } from "../../lib/simulations/copy.ts";

test("simulation copy has complete matching nonempty language keys", () => {
  expect(Object.keys(simulationCopy.en).sort()).toEqual(Object.keys(simulationCopy.sw).sort());
  for (const copy of Object.values(simulationCopy)) expect(Object.values(copy).every((v) => typeof v === "string" && v.trim())).toBe(true);
});
