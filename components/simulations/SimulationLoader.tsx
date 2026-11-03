"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import type { Lang } from "@/lib/i18n";
import type { SimulationId } from "@/lib/simulations/registry";
import type { SimulationCopy } from "@/lib/simulations/copy";

export type SimulationProps = { lang: Lang; c: SimulationCopy };
const subscribe = () => () => {};
const client = () => true;
const server = () => false;

export function SimulationLoader({ id, lang, c }: SimulationProps & { id: SimulationId }) {
  const ready = useSyncExternalStore(subscribe, client, server);
  const [Component, setComponent] = useState<ComponentType<SimulationProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (Component) title.current?.focus({ preventScroll: true }); }, [Component]);
  async function load() {
    setLoading(true); setError(false);
    try {
      const module = id === "utxo" ? await import("./UtxoSimulation") : await import("./ChannelSimulation");
      setComponent(() => module.default);
    } catch { setError(true); }
    finally { setLoading(false); }
  }
  return <section className="my-8 rounded-2xl border-2 border-teal-600/40 bg-[var(--card)] p-5" aria-labelledby="interactive-title" aria-busy={loading}>
    <h2 id="interactive-title" ref={title} tabIndex={-1} className="text-xl font-bold">{c.practice}</h2>
    {Component ? <Component lang={lang} c={c} /> : <>
      <p role="status" className="mt-2 text-sm text-[var(--muted)]">{loading ? c.loading : ""}</p>
      {error && <p role="alert" className="mt-3">{c.loadError}</p>}
      <button type="button" disabled={!ready || loading} onClick={load} className="mt-4 rounded-full bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{error ? c.retry : c.start}</button>
      {!ready && <p className="mt-3">{c.noJs}</p>}
    </>}
  </section>;
}
