"use client";

import { useState } from "react";
import { initialChannelState, settleExamplePayment } from "@/lib/simulations/channel";
import { parseSats } from "@/lib/simulations/amount";
import type { SimulationProps } from "./SimulationLoader";

export default function ChannelSimulation({ c, lang }: SimulationProps) {
  const [state, setState] = useState(initialChannelState);
  const [from, setFrom] = useState<"alice" | "bob">("alice");
  const [amount, setAmount] = useState("21000");
  const [error, setError] = useState<"invalidDirection" | "invalidAmount" | "channelFunds" | null>(null);
  const [status, setStatus] = useState("");
  const format = (n: number) => new Intl.NumberFormat(lang).format(n);
  function pay() {
    const result = settleExamplePayment(state, from, parseSats(amount));
    if (!result.ok) { setError(result.error); setStatus(""); return; }
    setState(result.value); setError(null);
    setStatus(`${c.sent} ${c.alice}: ${format(result.value.alice)}, ${c.bob}: ${format(result.value.bob)} ${c.sats}.`);
  }
  function reset() {
    setState(initialChannelState()); setFrom("alice"); setAmount("21000"); setError(null); setStatus(c.resetDone);
  }
  return <div data-module="CHANNEL_INTERACTIVE_MODULE" className="mt-5">
    <p className="text-center text-sm text-[var(--muted)]">{c.capacity}: <strong>{format(state.capacity)} {c.sats}</strong></p>
    <div className="mt-4 grid grid-cols-2 gap-4">
      {(["alice", "bob"] as const).map((person) => <div key={person} className="min-w-0 rounded-xl border border-[var(--line)] p-3">
        <p className="font-semibold">{c[person]}</p><p data-alice={person === "alice" ? "" : undefined} data-bob={person === "bob" ? "" : undefined} className="mt-1 text-2xl font-extrabold tabular-nums">{format(state[person])}</p>
        <p className="text-xs text-[var(--muted)]">{c.inExample} · {c.sats}</p>
      </div>)}
    </div>
    <div aria-hidden="true" className="mt-3 flex h-4 overflow-hidden rounded-full bg-dawn">
      <div className="bg-teal-700" style={{ width: `${state.alice / state.capacity * 100}%` }} />
    </div>
    <p data-channel-legend aria-hidden="true" className="mt-2 flex justify-between text-xs text-[var(--muted)]">
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-700" />{c.alice}</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-dawn" />{c.bob}</span>
    </p>
    <fieldset className="mt-6">
      <legend className="font-bold">{c.direction}</legend>
      <div className="mt-2 flex flex-wrap gap-3">{(["alice", "bob"] as const).map((person) => <label key={person} className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3">
        <input type="radio" name="channel-direction" checked={from === person} onChange={() => { setFrom(person); setError(null); setStatus(""); }} className="accent-teal-700" />
        {person === "alice" ? c.aliceToBob : c.bobToAlice}
      </label>)}</div>
    </fieldset>
    <label className="mt-5 block font-semibold">{c.recipient}
      <input type="text" inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value); setError(null); setStatus(""); }} aria-invalid={error === "invalidAmount" || error === "channelFunds"} aria-describedby={error ? "channel-error" : undefined} className="mt-1 w-full rounded-xl border-2 border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-base" />
    </label>
    {error && <p id="channel-error" role="alert" className="mt-4 font-semibold">{c[error]}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" onClick={pay} className="rounded-full bg-teal-700 px-5 py-3 font-semibold text-white">{c.send}</button>
      <button type="button" onClick={reset} className="rounded-full border border-teal-600 px-5 py-3 font-semibold text-teal-700 dark:text-teal-400">{c.reset}</button>
    </div>
    <p role="status" aria-atomic="true" className="mt-3">{status}</p>
    <h3 className="mt-6 font-bold">{c.history}</h3>
    {state.history.length === 0 ? <p className="mt-1 text-sm text-[var(--muted)]">{c.noHistory}</p> : <ol className="mt-2 space-y-2 text-sm">{state.history.map((payment, i) => <li key={i} className="rounded-xl border border-[var(--line)] p-3">
      <strong>{payment.from === "alice" ? c.aliceToBob : c.bobToAlice}: {format(payment.amount)} {c.sats}</strong>
      <p>{c.alice}: {format(payment.alice)} · {c.bob}: {format(payment.bob)} {c.sats}</p>
    </li>)}</ol>}
  </div>;
}
