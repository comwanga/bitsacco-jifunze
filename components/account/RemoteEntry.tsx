"use client";
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { Lang } from "@/lib/i18n";
import { secondaryBtn } from "./parts";
type Props = { lang: Lang; returnTo: string; bridge?: { id: string; opener: Window }; onClose: () => void };
export function RemoteEntry({ lang, returnTo, label, disabled, onBusyChange }: { lang: Lang; returnTo: string; label: string; disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const [Component, setComponent] = useState<ComponentType<Props> | null>(null);
  const [bridge, setBridge] = useState<Props["bridge"]>();
  const button = useRef<HTMLButtonElement>(null), loading = useRef(false);
  async function open() {
    if (loading.current) return;
    loading.current = true; onBusyChange(true);
    try { setComponent(() => null); const m = await import("./RemoteSigning"); setComponent(() => m.default); }
    catch { loading.current = false; onBusyChange(false); }
  }
  useEffect(() => {
    if (!window.opener || window.location.hash !== "#remote") return;
    const opener = window.opener;
    let accepted = false;
    const message = (e: MessageEvent) => {
      if (accepted || e.origin !== window.location.origin || e.source !== opener || e.data?.type !== "jifunze-remote-init" || typeof e.data.id !== "string") return;
      accepted = true; setBridge({ id: e.data.id, opener }); void open();
    };
    window.addEventListener("message", message);
    opener.postMessage({ type: "jifunze-remote-loaded" }, window.location.origin);
    return () => window.removeEventListener("message", message);
    // The initial handshake is intentionally one-shot. Parent state updates must not restart signing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return Component ? <Component lang={lang} returnTo={returnTo} bridge={bridge} onClose={() => { setComponent(null); loading.current = false; onBusyChange(false); requestAnimationFrame(() => button.current?.focus()); }} />
    : <p className="mt-4"><button ref={button} type="button" disabled={disabled} className={secondaryBtn} onClick={() => void open()}>{label}</button></p>;
}
