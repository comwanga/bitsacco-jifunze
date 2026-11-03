"use client";
import type { SimulationProps } from "./SimulationLoader";
export default function ChannelSimulation({ c }: SimulationProps) {
  return <div data-module="CHANNEL_INTERACTIVE_MODULE" className="mt-4">{c.channelTitle}</div>;
}
