"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { connectLab, forgetLab, pairLab, useLab } from "@/lib/lab/useLab";

const NAMES: Record<string, string> = { bitcoind: "bitcoind", alice: "Alice", bob: "Bob", chan: "Chan", dina: "Dina", erin: "Erin" };
const IMPL: Record<string, string> = { lnd: "LND", cln: "c-lightning", eclair: "Eclair", bitcoind: "regtest" };

export function LabBar({ lang }: { lang: Lang }) {
  const lab = useLab();
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const message =
    lab.phase === "idle"
      ? t(lang, "labIdle")
      : lab.phase === "checking"
      ? t(lang, "labChecking")
      : lab.phase === "absent"
        ? t(lang, "labAbsent")
        : lab.phase === "unpaired"
          ? t(lang, lab.problem === "wrong-code" ? "labWrongCode" : "labUnpaired")
          : t(lang, "labReady");

  return (
    <aside
      aria-label={t(lang, "labTitle")}
      className="sticky top-0 z-10 -mx-4 mb-6 border-b border-[var(--line)] bg-[#14100e] px-4 py-3 text-[#f3ece3] sm:mx-0 sm:rounded-b-xl"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <strong className="text-dawn">{t(lang, "labTitle")}</strong>
        <span aria-live="polite">{message}</span>
        {lab.phase === "idle" && <button type="button" onClick={() => void connectLab()} className="rounded-full bg-sun-deep px-4 py-1.5 font-semibold text-white">{t(lang, "labConnectCheck")}</button>}
        {lab.phase === "ready" && lab.status && (
          <span className="flex flex-wrap gap-1.5">
            {Object.entries(lab.status.nodes).map(([name, n]) => (
              <span key={name} className="inline-flex items-center gap-1 rounded-full bg-[#231c18] px-2.5 py-0.5 text-xs">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${n.ok ? "bg-teal-400" : "bg-sun"}`} />
                {NAMES[name] ?? name}
                <span className="text-[#9c8a78]">{IMPL[n.impl] ?? n.impl}</span>
              </span>
            ))}
          </span>
        )}
        {lab.phase === "ready" && (
          <button type="button" onClick={forgetLab} className="ml-auto text-xs text-[#b3a597] underline">
            {t(lang, "labForget")}
          </button>
        )}
      </div>

      {lab.phase !== "ready" && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await pairLab(code, url);
            setBusy(false);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            aria-label={t(lang, "labPair")}
            autoComplete="off"
            spellCheck={false}
            className="w-44 rounded-lg border border-[#362c25] bg-[#1e1916] px-3 py-1.5 font-mono tracking-wider uppercase"
          />
          <button type="submit" disabled={busy || code.trim().length < 12} className="rounded-full bg-sun-deep px-4 py-1.5 font-semibold text-white disabled:opacity-40">
            {t(lang, "labPair")}
          </button>
          <details className="text-xs text-[#b3a597]">
            <summary className="cursor-pointer">{t(lang, "labRemote")}</summary>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…-7777.app.github.dev"
              className="mt-1 w-72 rounded-lg border border-[#362c25] bg-[#1e1916] px-3 py-1.5"
            />
          </details>
          <p className="w-full text-xs text-[#b3a597]">{t(lang, "labPermission")}</p>
        </form>
      )}
      {lab.problem === "origin" && (
        <p className="mt-1 text-xs text-[#ffd9c4]">JIFUNZE_ORIGINS: {typeof window !== "undefined" ? window.location.origin : ""}</p>
      )}
    </aside>
  );
}
