"use client";

import { useState } from "react";
import type { SimulationProps } from "./SimulationLoader";
import { evaluateSavings, SAVINGS_PRESETS, type SavingsScenario } from "@/lib/simulations/savings";
import { savingsCopy } from "@/lib/simulations/savings-copy";

const fields = ["cash", "riskyAsset", "expense", "priceChange", "inflation", "feePercent", "fixedFee"] as const;
const initial = (s: SavingsScenario) => Object.fromEntries(fields.map((field) => [field, String(s[field])])) as Record<typeof fields[number], string>;

export default function SavingsSimulation({ lang }: SimulationProps) {
  const c = savingsCopy[lang];
  const [preset, setPreset] = useState<keyof typeof SAVINGS_PRESETS>("household");
  const [inputs, setInputs] = useState(initial(SAVINGS_PRESETS.household));
  const [assetAvailable, setAvailable] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof evaluateSavings>>(null);
  const [invalid, setInvalid] = useState(false);
  function reset(key: keyof typeof SAVINGS_PRESETS) {
    setPreset(key); setInputs(initial(SAVINGS_PRESETS[key])); setAvailable(true); setResult(null); setInvalid(false);
  }
  const format = (n: number) => new Intl.NumberFormat(lang === "sw" ? "sw-KE" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return <div data-module="SAVINGS_INTERACTIVE_MODULE" className="mt-4">
    <label className="block font-semibold" htmlFor="savings-case">{c.preset}</label>
    <select id="savings-case" value={preset} onChange={(e) => reset(e.target.value as keyof typeof SAVINGS_PRESETS)} className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
      {Object.keys(SAVINGS_PRESETS).map((key) => <option key={key} value={key}>{c[key as keyof typeof SAVINGS_PRESETS]}</option>)}
    </select>
    {preset === "cooperative" && <p className="mt-3 text-sm">{c.cooperativeNote}</p>}
    <form noValidate onSubmit={(e) => {
      e.preventDefault();
      const validText = fields.every((field) => /^-?\d+(?:\.\d{1,2})?$/.test(inputs[field]));
      const values = Object.fromEntries(fields.map((field) => [field, Number(inputs[field])])) as Omit<SavingsScenario, "assetAvailable">;
      const next = validText ? evaluateSavings({ ...values, assetAvailable }) : null;
      setResult(next); setInvalid(next === null);
    }}>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map((field) => <div key={field}>
        <label htmlFor={`savings-${field}`} className="block text-sm font-semibold">{c[field]}</label>
        <input id={`savings-${field}`} type="text" inputMode="decimal" maxLength={16} value={inputs[field]} aria-invalid={invalid || undefined} aria-describedby={invalid ? "savings-error" : undefined} onChange={(e) => { setInputs({ ...inputs, [field]: e.target.value }); setResult(null); setInvalid(false); }} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3" />
      </div>)}</div>
      <label className="mt-5 flex items-start gap-3"><input type="checkbox" checked={assetAvailable} onChange={(e) => { setAvailable(e.target.checked); setResult(null); setInvalid(false); }} className="mt-1 accent-teal-700" /><span>{c.availableLabel}</span></label>
      {invalid && <p id="savings-error" role="alert" className="mt-4">{c.invalid}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" className="rounded-full bg-teal-700 px-5 py-3 font-semibold text-white">{c.calculate}</button>
        <button type="button" onClick={() => reset(preset)} className="rounded-full border border-teal-600 px-5 py-3 font-semibold text-teal-700 dark:text-teal-400">{c.reset}</button>
      </div>
    </form>
    <div role="status" aria-atomic="true" className="mt-5">{result && <>
      <h3 className="font-bold">{c.result}</h3>
      <dl className="mt-3 space-y-2">{([['assetValue',c.assetValue],['netAsset',c.netAsset],['available',c.available],['expense',c.adjustedExpense],['balance',c.balance]] as const).map(([key,label]) => <div key={key} className="flex flex-wrap justify-between gap-x-4"><dt>{label}</dt><dd className="font-semibold tabular-nums">{format(result[key])} {c.units}</dd></div>)}</dl>
      <p className="mt-4">{c.feedback}</p>
    </>}</div>
  </div>;
}
