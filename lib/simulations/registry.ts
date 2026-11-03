import type { LessonKey } from "../progress/model.ts";
import type { Localized } from "../i18n.ts";
import { simulationCopy } from "./copy.ts";

export type SimulationId = "utxo" | "channel-balances";
export type SimulationEntry = { id: SimulationId; title: Localized; description: Localized; lessons: LessonKey[] };

export const SIMULATIONS: SimulationEntry[] = [
  { id: "utxo", title: { sw: simulationCopy.sw.utxoTitle, en: simulationCopy.en.utxoTitle },
    description: { sw: simulationCopy.sw.utxoLead, en: simulationCopy.en.utxoLead }, lessons: ["builders/utxos-transactions"] },
  { id: "channel-balances", title: { sw: simulationCopy.sw.channelTitle, en: simulationCopy.en.channelTitle },
    description: { sw: simulationCopy.sw.channelLead, en: simulationCopy.en.channelLead },
    lessons: ["savers/lightning-payments", "builders/lightning-basics", "lightning/payment-channels"] },
];

export const getSimulation = (id: string) => SIMULATIONS.find((s) => s.id === id);
export const simulationsForLesson = (key: LessonKey) => SIMULATIONS.filter((s) => s.lessons.includes(key));
