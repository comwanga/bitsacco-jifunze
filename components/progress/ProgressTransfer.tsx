"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { t, type DictKey, type Lang } from "@/lib/i18n";
import { exportFilename, serializeProgress } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/useProgress";

export type RoadmapSummary = { id: string; title: string; lessons: { slug: string; title: string }[] };

export function ProgressTransfer({ lang, roadmaps }: { lang: Lang; roadmaps: RoadmapSummary[] }) {
  const { progress, canPersist, importText } = useProgress();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function download() {
    const now = new Date().toISOString();
    const blob = new Blob([serializeProgress(progress, now)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename(now);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 512 * 1024) {
      setMessage({ ok: false, text: t(lang, "err_invalid-shape") });
      return;
    }
    const error = importText(await file.text());
    setMessage(error ? { ok: false, text: t(lang, `err_${error}` as DictKey) } : { ok: true, text: t(lang, "importOk") });
  }

  return (
    <>
      {!canPersist && <p className="mt-6 rounded-xl bg-dawn/20 p-4">{t(lang, "cannotPersist")}</p>}

      <div className="mt-8 space-y-8">
        {roadmaps.map((r) => {
          const done = r.lessons.filter((l) => progress.lessons[`${r.id}/${l.slug}`]?.completedAt).length;
          return (
            <section key={r.id} aria-labelledby={`p-${r.id}`}>
              <h2 id={`p-${r.id}`} className="text-xl font-bold">
                <Link href={`/${lang}/${r.id}/`} className="hover:underline">
                  {r.title}
                </Link>
              </h2>
              <p className="text-[var(--muted)]">
                {done} / {r.lessons.length} {t(lang, "done")}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--line)]">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${(done / r.lessons.length) * 100}%` }} />
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <button type="button" onClick={download} className="rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800">
          {t(lang, "exportBtn")}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-full border-2 border-teal-600 px-5 py-2.5 font-semibold text-teal-700 dark:text-teal-400"
        >
          {t(lang, "importBtn")}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />
      </div>
      {message && (
        <p role="status" className={`mt-4 rounded-xl p-4 ${message.ok ? "bg-teal-50 text-teal-900 dark:bg-teal-900/30 dark:text-teal-50" : "bg-[#fff0e8] text-[#6b2203] dark:bg-[#3d1a0c] dark:text-[#ffd9c4]"}`}>
          {message.text}
        </p>
      )}
    </>
  );
}
