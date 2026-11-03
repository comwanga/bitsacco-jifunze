"use client";
import type { SimulationProps } from "./SimulationLoader";
export default function UtxoSimulation({ c }: SimulationProps) {
  return <div data-module="UTXO_INTERACTIVE_MODULE" className="mt-4">{c.utxoTitle}</div>;
}
