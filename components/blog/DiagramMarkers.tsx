"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";

export type DiagramMarker = { n: number; x: number; y: number; title: string; text: ReactNode };

const subscribe = () => () => {};

/**
 * Server and no-JavaScript render: numbered spans on the image and a visible numbered list.
 * After hydration the spans become buttons and one explanation shows in a panel below the image;
 * the list stays for screen readers.
 */
export function DiagramMarkers({ src, alt, markers, lang }: { src: string; alt: string; markers: DiagramMarker[]; lang: Lang }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [open, setOpen] = useState<number | null>(null);
  const panelId = useId();
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const returnTo = useRef<number | null>(null);

  function close() {
    const n = returnTo.current;
    setOpen(null);
    if (n !== null) buttons.current.get(n)?.focus();
  }
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      const n = returnTo.current;
      if (n !== null) buttons.current.get(n)?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const current = markers.find((m) => m.n === open);
  const dot = "absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-sun-deep text-sm font-bold text-white shadow";

  return (
    <>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export serves the file as-is */}
        <img src={src} alt={alt} className="h-auto w-full rounded-xl border border-[var(--line)]" />
        {markers.map((m) =>
          ready ? (
            <button
              key={m.n}
              type="button"
              data-marker={m.n}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              ref={(el) => { if (el) buttons.current.set(m.n, el); else buttons.current.delete(m.n); }}
              aria-expanded={open === m.n}
              aria-controls={panelId}
              aria-label={`${m.n}. ${m.title}`}
              onClick={() => { if (open === m.n) close(); else { returnTo.current = m.n; setOpen(m.n); } }}
              className={`${dot} cursor-pointer focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${open === m.n ? "ring-4 ring-dawn" : ""}`}
            >
              {m.n}
            </button>
          ) : (
            <span key={m.n} data-marker={m.n} style={{ left: `${m.x}%`, top: `${m.y}%` }} aria-hidden="true" className={dot}>
              {m.n}
            </span>
          ),
        )}
      </div>
      {ready && (
        <div id={panelId} data-diagram-panel role="region" aria-live="polite" aria-label={lang === "sw" ? "Maelezo ya alama" : "Marker explanation"} className="mt-3 min-h-0">
          {current && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-warm)] p-4">
              <p className="m-0 font-bold">{current.n}. {current.title}</p>
              <div className="mt-1">{current.text}</div>
            </div>
          )}
        </div>
      )}
      <ol data-diagram-notes className={ready ? "sr-only" : "mt-4 list-decimal space-y-2 pl-6"}>
        {markers.map((m) => (
          <li key={m.n}>
            <strong>{m.title}</strong>: {m.text}
          </li>
        ))}
      </ol>
    </>
  );
}
