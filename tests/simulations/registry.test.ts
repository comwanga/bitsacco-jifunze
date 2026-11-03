import { expect, test } from "vitest";
import { getSimulation, simulationsForLesson, SIMULATIONS } from "../../lib/simulations/registry.ts";
import { validateSimulationLessons } from "../../lib/content/tree.ts";

test("registry contains only the approved simulations and valid lesson targets", () => {
  expect(SIMULATIONS.map((s) => s.id)).toEqual(["utxo", "channel-balances"]);
  expect(getSimulation("utxo")?.lessons).toEqual(["builders/utxos-transactions"]);
  expect(simulationsForLesson("lightning/payment-channels").map((s) => s.id)).toEqual(["channel-balances"]);
  expect(simulationsForLesson("savers/scams")).toEqual([]);
  expect(getSimulation("unknown")).toBeUndefined();
  expect(() => validateSimulationLessons(SIMULATIONS)).not.toThrow();
  expect(() => validateSimulationLessons([{ ...SIMULATIONS[0], lessons: ["builders/missing"] }])).toThrow(/Unknown lesson/);
});
