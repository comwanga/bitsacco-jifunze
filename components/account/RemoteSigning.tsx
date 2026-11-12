"use client";
import { useEffect, useRef, useState } from "react";
import encodeQR from "@paulmillr/qr";
import type { Lang } from "@/lib/i18n";
import { remoteSigningCopy } from "@/lib/remote-signing-copy";
import { remoteAttempt, RemoteError } from "@/lib/nostr/remote";
import { authenticationTemplate } from "@/lib/nostr/remote-policy";
import { ACCOUNT_KEY } from "@/lib/progress/keys";
import { apiFetch, safeReturn, type Me } from "./api";
import { prepareProof } from "./nostr-proof";
import { errorText } from "@/lib/account-copy";
import { primaryBtn, secondaryBtn } from "./parts";

class InterfaceError extends Error {}

type Bridge = { id: string; opener: Window };
export default function RemoteSigning({ lang, returnTo, bridge, onClose }: { lang: Lang; returnTo: string; bridge?: Bridge; onClose: () => void }) {
  const c = remoteSigningCopy[lang];
  const [address, setAddress] = useState("");
  const [uri, setUri] = useState("");
  const [phase, setPhase] = useState<"idle" | "waiting" | "signing" | "verifying" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<ReturnType<typeof remoteAttempt> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0), locked = useRef(false), sent = useRef(false);
  const title = useRef<HTMLHeadingElement>(null), alert = useRef<HTMLParagraphElement>(null);
  const bridgeSign = useRef<((event: unknown, requestId: string) => void) | null>(null);
  const busy = phase === "waiting" || phase === "signing" || phase === "verifying";
  function clear() { generation.current++; abort.current?.abort(); attempt.current?.close(); attempt.current = null; abort.current = null; bridgeSign.current = null; }
  useEffect(() => { title.current?.focus(); const leave = () => clear(); window.addEventListener("pagehide", leave); return () => { window.removeEventListener("pagehide", leave); clear(); }; }, []);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  useEffect(() => {
    if (!bridge) return;
    const message = (e: MessageEvent) => {
      const m = e.data;
      if (e.origin !== window.location.origin || e.source !== bridge.opener || m?.id !== bridge.id || m.type !== "jifunze-remote-sign" || typeof m.requestId !== "string") return;
      bridgeSign.current?.(m.event, m.requestId);
    };
    window.addEventListener("message", message); return () => window.removeEventListener("message", message);
  }, [bridge]);
  function cancel() {
    if (sent.current) return;
    clear(); locked.current = false; setAddress(""); setUri(""); setPhase("idle"); setError(c.cancelled);
    bridge?.opener.postMessage({ type: "jifunze-remote-cancel", id: bridge.id }, window.location.origin);
  }
  async function start(mode: "pair" | "bunker") {
    if (locked.current) return;
    locked.current = true; clear(); const mine = generation.current;
    const active = () => mine === generation.current && !abort.current?.signal.aborted;
    const control = new AbortController(); abort.current = control;
    setError(null); setPhase("waiting"); const input = address; setAddress("");
    try {
      let prepared;
      if (!bridge) {
        const me = await apiFetch<Me>("/api/me", { signal: control.signal });
        if (!active()) return;
        if (!me.ok && me.code !== "unauthenticated") throw new InterfaceError(errorText(lang, me.code));
        prepared = await prepareProof<{ redirect: string }>("signin", lang, me.ok ? me.data.account.id : "anonymous", { remote: true, returnTo, signal: control.signal });
        if (!active()) return;
        if (!prepared.ok) throw new InterfaceError(errorText(lang, prepared.code));
      }
      let remote: ReturnType<typeof remoteAttempt>;
      try { remote = remoteAttempt(window.location.origin, mode === "bunker" ? input.trim() : undefined); }
      catch { throw new InterfaceError(c.badAddress); } // only a pasted address can be refused before connecting
      attempt.current = remote; setUri(remote.uri);
      void remote.failure.catch((e) => {
        if (!active() || sent.current || e?.reason === "cancelled") return;
        setError(e instanceof RemoteError ? c[e.reason] : c.invalid); setPhase("idle"); setUri(""); locked.current = false;
      });
      await remote.ready;
      if (!active()) return;
      setUri(""); setPhase("signing");
      if (bridge) {
        bridgeSign.current = async (event, requestId) => {
          if (!active() || !authenticationTemplate(event, window.location.origin)) return;
          bridgeSign.current = null;
          try {
            const proof = await remote.signEvent(event);
            if (!active()) return;
            sent.current = true; setPhase("done");
            bridge.opener.postMessage({ type: "jifunze-remote-result", id: bridge.id, requestId, event: proof }, window.location.origin);
          } catch { if (active()) { setError(c.invalid); setPhase("idle"); locked.current = false; remote.close(); } }
        };
        bridge.opener.postMessage({ type: "jifunze-remote-ready", id: bridge.id }, window.location.origin);
      } else if (prepared?.ok) {
        const result = await prepared.data.complete({ signEvent: async (t) => {
          const event = await remote.signEvent(t);
          if (!active()) throw new RemoteError("cancelled");
          // The signature is now handed to HTTP verification. Cancellation cannot undo a committed response.
          sent.current = true; setPhase("verifying"); return event;
        } }, () => setPhase("signing"));
        if (!active()) return;
        if (!result.ok) throw new InterfaceError(errorText(lang, result.code));
        try { localStorage.setItem(ACCOUNT_KEY, "?"); } catch { /* optional sync hint */ }
        window.location.assign(safeReturn(lang, result.data.redirect));
      }
    } catch (e) {
      if (active()) {
        setError(e instanceof RemoteError ? c[e.reason] : e instanceof InterfaceError ? e.message : c.invalid);
        setPhase("idle"); setUri(""); attempt.current?.close(); locked.current = false; sent.current = false;
      }
    }
  }
  const matrix = uri ? encodeQR(uri, "raw", { ecc: "medium", border: 4 }) : null;
  return <section className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] p-4" data-remote-signing>
    <h2 ref={title} tabIndex={-1} className="text-xl font-bold">{c.heading}</h2>
    <p>{c.lead}</p>{bridge && <p>{c.returnHelp}</p>}
    {/* Start stays in place while an attempt runs: a second tap must land on an inert Start, never on Cancel moving up. */}
    {phase !== "done" && <button type="button" className={`${primaryBtn} ${busy ? "cursor-not-allowed opacity-50" : ""}`} aria-disabled={busy} onClick={() => { if (!busy) void start("pair"); }}>{c.start}</button>}
    {uri && <div className="space-y-3"><a className={primaryBtn} href={uri}>{c.open}</a><p>{c.noApp}</p><p>{c.scan}</p>
      {matrix && <svg role="img" aria-label={c.qr} viewBox={`0 0 ${matrix.length} ${matrix.length}`} className="mx-auto w-full max-w-64 bg-white" shapeRendering="crispEdges"><path fill="#000" d={matrix.flatMap((row, y) => row.flatMap((cell, x) => cell ? [`M${x},${y}h1v1h-1z`] : [])).join("")} /></svg>}
      <p className="text-sm">{c.privacy}</p></div>}
    {/* The pasted address is the advanced path; beginners never need to open it. */}
    {phase !== "done" && <details className="rounded-xl border border-[var(--line)] p-3">
      <summary className="cursor-pointer font-semibold">{c.bunker}</summary>
      <p className="mt-3">{c.bunkerLead}</p>
      <label className="mt-3 block font-semibold" htmlFor="bunker-address">{c.address}</label>
      <input id="bunker-address" type="password" autoComplete="off" spellCheck={false} disabled={busy} value={address} onChange={(e) => setAddress(e.target.value)} aria-describedby="bunker-help" className="mt-2 w-full rounded-lg border border-[var(--line)] p-3" />
      <p id="bunker-help" className="mt-2">{c.addressHelp}</p>
      <button type="button" className={`${secondaryBtn} mt-3`} disabled={busy || !address.trim()} onClick={() => void start("bunker")}>{c.bunkerStart}</button>
    </details>}
    <p role="status" aria-live="polite">{phase === "waiting" ? c.waiting : phase === "signing" ? c.signing : phase === "verifying" ? c.verifying : phase === "done" ? c.received : ""}</p>
    {error && <p ref={alert} role="alert" tabIndex={-1} className="rounded-xl border border-[var(--line)] p-3">{error}</p>}
    {phase === "done" ? <button className={secondaryBtn} onClick={() => window.close()}>{c.close}</button> : <button type="button" disabled={phase === "verifying"} className={secondaryBtn} onClick={() => { cancel(); if (!bridge) onClose(); }}>{c.cancel}</button>}
  </section>;
}
