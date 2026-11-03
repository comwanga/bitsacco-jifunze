"use client";

import { useState } from "react";
import { buildTransaction, initialUtxoState, previewTransaction, type UtxoError } from "@/lib/simulations/utxo";
import { parseSats } from "@/lib/simulations/amount";
import type { SimulationProps } from "./SimulationLoader";

const field = "mt-1 w-full rounded-xl border-2 border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-base";

export default function UtxoSimulation({ c, lang }: SimulationProps) {
  const [state, setState] = useState(initialUtxoState);
  const [coinIds, setCoinIds] = useState<string[]>([]);
  const [payment, setPayment] = useState("7000");
  const [fee, setFee] = useState("500");
  const [error, setError] = useState<UtxoError | null>(null);
  const [status, setStatus] = useState("");
  const format = (n: number) => new Intl.NumberFormat(lang).format(n);
  const request = { coinIds, payment: parseSats(payment), fee: parseSats(fee) };
  const preview = previewTransaction(state, request);
  const selectedTotal = state.coins.filter((coin) => coinIds.includes(coin.id)).reduce((sum, coin) => sum + coin.sats, 0);
  const clearFeedback = () => { setError(null); setStatus(""); };
  // Point the error at the control it is about; "funds" and "overflow" concern all three.
  const describe = (...kinds: UtxoError[]) => (error && kinds.includes(error) ? "utxo-error" : undefined);

  function build() {
    const result = buildTransaction(state, request);
    if (!result.ok) { setError(result.error); setStatus(""); return; }
    setState(result.value); setCoinIds([]); setError(null);
    setStatus(`${c.built} ${c.transaction} ${result.value.history.length}: ${format(request.payment)} ${c.sats}.`);
  }
  function reset() {
    setState(initialUtxoState()); setCoinIds([]); setPayment("7000"); setFee("500"); setError(null); setStatus(c.resetDone);
  }

  return <div data-module="UTXO_INTERACTIVE_MODULE" className="mt-5">
    <fieldset aria-describedby={describe("noCoins", "duplicateCoin", "unknownCoin", "spentCoin", "funds", "overflow")}>
      <legend className="font-bold">{c.coins}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">{state.coins.map((coin, i) => <label key={coin.id} className={`flex items-start gap-3 rounded-xl border-2 p-3 ${coin.spent ? "border-[var(--line)] text-[var(--muted)]" : "border-teal-600/50"}`}>
        <input type="checkbox" checked={coinIds.includes(coin.id)} disabled={coin.spent} onChange={(e) => { setCoinIds(e.target.checked ? [...coinIds, coin.id] : coinIds.filter((id) => id !== coin.id)); clearFeedback(); }} className="mt-1 accent-teal-700" />
        <span className="min-w-0"><span className="block text-sm">{c.coin} {i + 1}</span><strong className="block">{format(coin.sats)} {c.sats}</strong><span className="block text-xs">{coin.spent ? c.spent : c.available}</span></span>
      </label>)}</div>
    </fieldset>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="font-semibold">{c.recipient}<input type="text" inputMode="numeric" value={payment} onChange={(e) => { setPayment(e.target.value); clearFeedback(); }} aria-invalid={error === "invalidAmount"} aria-describedby={describe("invalidAmount", "funds", "overflow")} className={field} /></label>
      <label className="font-semibold">{c.fee}<input type="text" inputMode="numeric" value={fee} onChange={(e) => { setFee(e.target.value); clearFeedback(); }} aria-invalid={error === "invalidFee"} aria-describedby={describe("invalidFee", "funds", "overflow")} className={field} /></label>
    </div>
    <section aria-labelledby="utxo-preview" className="mt-5 rounded-xl bg-teal-50 p-4 text-teal-900 dark:bg-teal-900/30 dark:text-teal-50">
      <h3 id="utxo-preview" className="font-bold">{c.preview}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt>{c.selected}</dt><dd className="text-right tabular-nums">{format(selectedTotal)} {c.sats}</dd>
        <dt>{c.paid}</dt><dd className="text-right tabular-nums">{Number.isSafeInteger(request.payment) && request.payment > 0 ? format(request.payment) : "—"} {c.sats}</dd>
        <dt>{c.feeShort}</dt><dd className="text-right tabular-nums">{Number.isSafeInteger(request.fee) && request.fee >= 0 ? format(request.fee) : "—"} {c.sats}</dd>
        <dt className="font-bold">{c.change}</dt><dd data-change className="text-right font-bold tabular-nums">{preview.ok ? format(preview.value.change) : "—"} {c.sats}</dd>
      </dl>
    </section>
    {error && <p id="utxo-error" role="alert" className="mt-4 font-semibold">{c[error]}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" onClick={build} className="rounded-full bg-teal-700 px-5 py-3 font-semibold text-white">{c.build}</button>
      <button type="button" onClick={reset} className="rounded-full border border-teal-600 px-5 py-3 font-semibold text-teal-700 dark:text-teal-400">{c.reset}</button>
    </div>
    <p role="status" aria-atomic="true" className="mt-3">{status}</p>
    <h3 className="mt-6 font-bold">{c.history}</h3>
    {state.history.length === 0 ? <p className="mt-1 text-sm text-[var(--muted)]">{c.noHistory}</p> : <ol className="mt-2 space-y-2 text-sm">{state.history.map((tx, i) => <li key={tx.id} className="rounded-xl border border-[var(--line)] p-3">
      <strong>{c.transaction} {i + 1}</strong><p>{c.selected}: {format(tx.total)} = {c.paid}: {format(tx.payment)} + {c.feeShort}: {format(tx.fee)} + {c.change}: {format(tx.change)} {c.sats}</p>
    </li>)}</ol>}
  </div>;
}
