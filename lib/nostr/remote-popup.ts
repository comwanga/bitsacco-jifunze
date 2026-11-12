import type { Lang } from "@/lib/i18n";
import type { ProofTemplate } from "@/components/account/nostr-proof";

/** Explicit click only. Same-origin sign-in popup owns relay access; the opener retains its account condition. */
export function openRemoteSigner(lang: Lang) {
  const popup = window.open(`/${lang}/account/signin/#remote`, "_blank", "popup,width=480,height=760");
  if (!popup) throw new Error("popup");
  const id = crypto.randomUUID(), origin = window.location.origin;
  const controller = new AbortController();
  const deadline = Date.now() + 120_000;
  let finished = false, delivered = false, requestId: string | undefined;
  let resolveReady!: () => void, rejectReady!: (e: Error) => void;
  let resolveEvent: ((v: unknown) => void) | undefined, rejectEvent: ((e: Error) => void) | undefined;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  void ready.catch(() => {});
  function close() {
    if (finished) return;
    finished = true;
    clearInterval(poll); window.removeEventListener("message", message); window.removeEventListener("pagehide", close);
    if (!delivered) { controller.abort(); rejectReady(new Error("cancelled")); rejectEvent?.(new Error("cancelled")); }
    popup?.close();
  }
  function message(event: MessageEvent) {
    if (finished || event.origin !== origin || event.source !== popup || Date.now() >= deadline) return;
    const m = event.data;
    if (m?.type === "jifunze-remote-loaded") { popup!.postMessage({ type: "jifunze-remote-init", id }, origin); return; }
    if (m?.id !== id) return;
    if (m.type === "jifunze-remote-ready") resolveReady();
    if (m.type === "jifunze-remote-cancel") close();
    if (m.type === "jifunze-remote-result" && requestId && m.requestId === requestId && resolveEvent) {
      delivered = true; resolveEvent(m.event); close();
    }
  }
  window.addEventListener("message", message); window.addEventListener("pagehide", close);
  const poll = setInterval(() => { if (popup.closed || Date.now() >= deadline) close(); }, 300);
  return { ready, signal: controller.signal, close,
    signEvent: (event: ProofTemplate): Promise<unknown> => {
      if (finished || requestId || Date.now() >= deadline) return Promise.reject(new Error("cancelled"));
      requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        resolveEvent = resolve; rejectEvent = reject;
        popup.postMessage({ type: "jifunze-remote-sign", id, requestId, event }, origin);
      });
    },
  };
}
