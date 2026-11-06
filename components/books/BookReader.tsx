"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";

const copy = {
  en: {
    read: "Read PDF", loading: "Loading and checking the complete PDF…", cancel: "Cancel",
    error: "The PDF could not be loaded or verified. Check your connection and try again, or use the direct download.",
    retry: "Try again", download: "Download complete PDF", open: "Open PDF in browser",
    help: "Use your browser’s PDF controls for pages, search and zoom. If embedded reading is unsupported, open the PDF in your browser or download it.",
    offline: "The book loads only when you choose to read or download it. It is not automatically saved in the offline lesson cache.",
    title: "Mastering Bitcoin, third edition — English PDF",
  },
  sw: {
    read: "Soma PDF", loading: "Inapakia na kukagua PDF nzima…", cancel: "Ghairi",
    error: "PDF haikuweza kupakiwa au kuthibitishwa. Angalia muunganisho wako kisha ujaribu tena, au tumia upakuaji wa moja kwa moja.",
    retry: "Jaribu tena", download: "Pakua PDF nzima", open: "Fungua PDF kwenye kivinjari",
    help: "Tumia vidhibiti vya PDF vya kivinjari kubadili kurasa, kutafuta na kukuza. Ikiwa usomaji hapa haupatikani, fungua PDF kwenye kivinjari au uipakue.",
    offline: "Kitabu hupakiwa unapochagua kukisoma au kukipakua. Hakihifadhiwi kiotomatiki pamoja na masomo ya nje ya mtandao.",
    title: "Mastering Bitcoin, toleo la 3 — PDF ya Kiingereza",
  },
};
const subscribe = () => () => {};

export function BookReader({ lang, url, bytes, sha256, filename }: { lang: Lang; url: string; bytes: number; sha256: string; filename: string }) {
  const c = copy[lang];
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => { if (blobUrl) frame.current?.focus(); }, [blobUrl]);
  useEffect(() => () => {
    active.current?.abort();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  async function load() {
    const controller = new AbortController();
    active.current = controller;
    setPhase("loading");
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      // One requested download, reused by the native viewer and the download action.
      // Reading the response detects interrupted transfers, rather than trusting iframe.onload.
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("application/pdf")) throw Error("PDF response");
      const data = await response.arrayBuffer();
      if (data.byteLength !== bytes || new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") throw Error("PDF length/type");
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map(n => n.toString(16).padStart(2, "0")).join("");
      if (hash !== sha256) throw Error("PDF integrity");
      if (active.current !== controller || controller.signal.aborted) return;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const blob = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      objectUrl.current = blob;
      setBlobUrl(blob);
      setPhase("ready");
    } catch {
      if (active.current === controller) setPhase("error");
    } finally {
      clearTimeout(timer);
    }
  }
  function cancel() { active.current?.abort(); active.current = null; setPhase("idle"); }
  const action = "inline-block rounded-full border-2 border-teal-700 px-5 py-2.5 font-semibold text-teal-800 dark:text-teal-200";
  return <section data-pdf-reader aria-label={c.title} className="mt-8">
    <p className="max-w-prose text-[var(--muted)]">{c.offline}</p>
    <div className="my-4 flex flex-wrap gap-3">
      {(phase === "idle" || phase === "error") && <button type="button" disabled={!ready} onClick={() => void load()} className={action}>{phase === "error" ? c.retry : c.read}</button>}
      {phase === "loading" && <button type="button" onClick={cancel} className={action}>{c.cancel}</button>}
      <a href={blobUrl || url} download={filename} type="application/pdf" aria-disabled={phase === "loading" || undefined} onClick={e => { if (phase === "loading") e.preventDefault(); }} className={action}>{c.download}</a>
      <a href={url} type="application/pdf" target="_blank" rel="noopener noreferrer" aria-disabled={phase === "loading" || undefined} onClick={e => { if (phase === "loading") e.preventDefault(); }} className={action}>{c.open}</a>
    </div>
    {phase === "loading" && <p role="status" className="my-4">{c.loading}</p>}
    {phase === "error" && <p role="alert" className="my-4 rounded-xl bg-dawn/20 p-4">{c.error}</p>}
    <p className="my-4 max-w-prose text-sm text-[var(--muted)]">{c.help}</p>
    {blobUrl && <iframe ref={frame} src={blobUrl} title={c.title} className="h-[75svh] min-h-96 w-full rounded-xl border border-[var(--line)]" />}
  </section>;
}
