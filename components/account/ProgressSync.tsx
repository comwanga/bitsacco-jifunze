"use client";

import { useEffect, useRef, useState } from "react";
import { syncCopy } from "@/lib/sync-copy";
import type { Lang } from "@/lib/i18n";
import type { Ownership, SyncResult } from "@/lib/progress/sync";
import { card, primaryBtn, secondaryBtn } from "./parts";

// Loaded on demand: the page itself stays small, and nothing runs until an account is confirmed.
const sync = () => import("@/lib/progress/sync");

type View = { owns: Ownership; result: SyncResult | "working" | "declined" | null; confirmReplace: boolean };

/**
 * Whether this device's progress is saved to the signed-in account. Progress made without an account joins the
 * account only when the learner says so, and another account's copy is never merged: it can be downloaded and,
 * after an explicit confirmation, replaced.
 */
export default function ProgressSync({ lang, accountId }: { lang: Lang; accountId: string }) {
  const c = syncCopy[lang];
  const [view, setView] = useState<View | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  async function run(action: (m: Awaited<ReturnType<typeof sync>>) => Promise<SyncResult>, focus = true) {
    setView((v) => ({ owns: v?.owns ?? "mine", result: "working", confirmReplace: false }));
    try {
      const m = await sync();
      const result = await action(m);
      setView({ owns: m.ownership(accountId), result, confirmReplace: false });
    } catch {
      setView((v) => ({ owns: v?.owns ?? "mine", result: "offline", confirmReplace: false })); // the sync code could not be loaded
    }
    if (focus) requestAnimationFrame(() => statusRef.current?.focus());
  }

  useEffect(() => {
    let current = true;
    let unsubscribe: (() => void) | undefined;
    void sync().then((m) => {
      if (!current) return;
      m.signedIn(accountId);
      m.showStatus();
      unsubscribe = m.subscribeStatus(() => {
        if (!current) return;
        const owns = m.ownership(accountId), status = m.persistenceStatus();
        setView((v) => v?.confirmReplace || (owns === "unclaimed" && v?.result === "declined") ? v : {
          owns, result: status === "expired" || status === "local" ? "signed-out" : status === "other" || status === "unclaimed" ? null : status, confirmReplace: false,
        });
      });
      const owns = m.ownership(accountId);
      if (owns !== "mine") setView({ owns, result: null, confirmReplace: false });
      else void run((s) => s.syncNow(), false);
    }).catch(() => { if (current) setView({ owns: "mine", result: "offline", confirmReplace: false }); });
    return () => { current = false; unsubscribe?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per signed-in account
  }, [accountId]);

  async function download() {
    const now = new Date().toISOString();
    const file = (await sync()).exportDevice(now);
    const url = URL.createObjectURL(new Blob([file.text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const status = (r: View["result"]): string | null =>
    r === "working" ? c.syncWorking
      : r === "synced" ? c.syncSaved
        : r === "busy" || r === "pending" ? c.syncPending
        : r === "offline" ? c.syncOffline
          : r === "signed-out" ? c.syncExpired : r === "error" ? c.syncError
            : null;

  return (
    <section aria-labelledby="sync-heading" className={`mt-6 ${card}`} data-progress-sync={view ? `${view.owns}:${view.result ?? ""}` : "loading"}>
      <h2 id="sync-heading" className="text-xl font-bold">{c.syncHeading}</h2>
      {view?.owns === "unclaimed" && (
        <>
          <p className="mt-2">{view.result === "declined" ? c.syncSeparate : c.syncAsk}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={primaryBtn} onClick={() => void run((m) => m.claim(accountId))}>{c.syncAdd}</button>
            {view.result !== "declined" && (
              <button type="button" className={secondaryBtn} onClick={() => setView({ ...view, result: "declined" })}>{c.syncNotNow}</button>
            )}
          </div>
        </>
      )}
      {view?.owns === "other" && (
        <>
          <p className="mt-2">{c.syncOther}</p>
          {view.confirmReplace ? (
            <div className="mt-3 rounded-xl bg-dawn/20 p-4">
              <p>{c.syncReplaceWarn}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" className={primaryBtn} onClick={() => void run((m) => m.replaceWithAccount(accountId))}>{c.syncReplaceConfirm}</button>
                <button type="button" className={secondaryBtn} onClick={() => setView({ ...view, confirmReplace: false })}>{c.syncCancel}</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={secondaryBtn} onClick={() => void download()}>{c.syncDownload}</button>
              <button type="button" className={secondaryBtn} onClick={() => setView({ ...view, confirmReplace: true })}>{c.syncReplace}</button>
            </div>
          )}
        </>
      )}
      <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="mt-2 text-[var(--muted)]">
        {view && view.owns === "mine" ? status(view.result) : null}
      </p>
      {view?.owns === "mine" && (view.result === "offline" || view.result === "error") && (
        <p className="mt-3"><button type="button" className={secondaryBtn} onClick={() => void run((m) => m.syncNow())}>{c.syncRetry}</button></p>
      )}
    </section>
  );
}
