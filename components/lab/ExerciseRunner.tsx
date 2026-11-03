"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { check, LabError, reset, run, type CheckResult, type RunResult } from "@/lib/lab/client";
import { refreshLab, useLab } from "@/lib/lab/useLab";
import type { LessonKey } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/useProgress";

type Tab = "cli" | "python";
export type ExerciseProps = {
  id: string;
  title: string;
  node: string;
  tab: Tab;
  profile?: "full";
  starter: { cli?: string; python?: string };
};

const NODE_LABEL: Record<string, string> = {
  alice: "Alice · LND",
  bob: "Bob · c-lightning",
  chan: "Chan · c-lightning",
  dina: "Dina · LND",
  erin: "Erin · Eclair",
};

function storageKey(id: string, tab: Tab) {
  return `jifunze:code:${id}:${tab}`;
}

function readDraft(id: string, tab: Tab): string | null {
  try {
    return sessionStorage.getItem(storageKey(id, tab));
  } catch {
    return null;
  }
}

export function ExerciseRunner({
  lang,
  exercise,
  lessonKey,
  lesson,
  allIds,
}: {
  lang: Lang;
  exercise: ExerciseProps;
  lessonKey: LessonKey;
  lesson: string;
  allIds: string[];
}) {
  const lab = useLab();
  const { progress, labPass } = useProgress();
  const tabs = (["cli", "python"] as Tab[]).filter((x) => exercise.starter[x] !== undefined);
  const [tab, setTab] = useState<Tab>(exercise.tab);
  const [node, setNode] = useState(exercise.node);
  const [code, setCode] = useState<Record<Tab, string>>({ cli: exercise.starter.cli ?? "", python: exercise.starter.python ?? "" });
  const [busy, setBusy] = useState<"run" | "check" | "reset" | null>(null);
  const [output, setOutput] = useState<RunResult | null>(null);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const passed = progress.lessons[lessonKey]?.lab?.passed.includes(exercise.id) ?? false;
  const ready = lab.phase === "ready";
  const needsFull = exercise.profile === "full" && lab.status?.profile !== "full";

  useEffect(() => {
    // Restore any draft from this browser session after hydration (sessionStorage isn't on the server,
    // so reading it during render would make the server and client HTML disagree).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode((c) => ({ cli: readDraft(exercise.id, "cli") ?? c.cli, python: readDraft(exercise.id, "python") ?? c.python }));
  }, [exercise.id]);

  function edit(value: string) {
    setCode((c) => ({ ...c, [tab]: value }));
    try {
      sessionStorage.setItem(storageKey(exercise.id, tab), value);
    } catch {
      /* fine: drafts are a convenience */
    }
  }

  function explain(e: unknown) {
    if (e instanceof LabError && (e.kind === "not-found" || e.kind === "unauthorized")) void refreshLab();
    setNote(t(lang, e instanceof LabError && e.kind === "not-found" ? "labAbsent" : "labError"));
  }

  async function doCheck() {
    setBusy("check");
    try {
      const results = await check(lab.config, exercise.id);
      setChecks(results);
      if (results.length > 0 && results.every((r) => r.pass)) labPass(lessonKey, exercise.id, allIds);
    } catch (e) {
      explain(e);
    } finally {
      setBusy(null);
    }
  }

  async function doRun() {
    if (!ready || busy) return;
    setBusy("run");
    setNote(null);
    try {
      setOutput(await run(lab.config, { exercise: exercise.id, node, tab, code: code[tab] }));
    } catch (e) {
      explain(e);
      setBusy(null);
      return;
    }
    await doCheck();
  }

  async function doReset() {
    setBusy("reset");
    setNote(t(lang, "labResetting"));
    try {
      const r = await reset(lab.config, lesson);
      setNote(r.ok ? r.log.split("\n").slice(-1)[0] : r.log);
      setChecks(null);
    } catch (e) {
      explain(e);
    } finally {
      setBusy(null);
    }
  }

  const nodes = ["alice", "bob", "chan", "dina", ...(lab.status?.profile === "full" ? ["erin"] : []), "none"];

  return (
    <div className="not-prose rounded-xl bg-[#14100e] p-3 text-[13px] text-[#f3ece3]">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1">
          {tabs.map((x) => (
            <button
              key={x}
              type="button"
              role="tab"
              aria-selected={tab === x}
              onClick={() => setTab(x)}
              className={`rounded-t-lg px-3 py-1 text-xs ${tab === x ? "border-b-2 border-dawn bg-[#1b1714] text-white" : "bg-[#231c18] text-[#b3a597]"}`}
            >
              {x === "cli" ? "CLI" : "Python"}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1 text-xs text-[#b3a597]">
          {t(lang, "labNode")}
          <select
            value={node}
            onChange={(e) => setNode(e.target.value)}
            className="rounded-lg border border-[#362c25] bg-[#231c18] px-2 py-1 text-[#f3ece3]"
          >
            {nodes.map((n) => (
              <option key={n} value={n}>
                {n === "none" ? t(lang, "labNoNode") : NODE_LABEL[n]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        value={code[tab]}
        onChange={(e) => edit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void doRun();
          } else if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: end } = el;
            edit(code[tab].slice(0, s) + "  " + code[tab].slice(end));
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          }
        }}
        spellCheck={false}
        aria-label={exercise.title}
        rows={Math.min(18, Math.max(4, code[tab].split("\n").length + 1))}
        className="mt-0 block w-full resize-y rounded-b-lg rounded-tr-lg bg-[#1b1714] p-3 font-mono text-[12.5px] leading-relaxed text-[#e9ddcf] focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void doRun()}
          disabled={!ready || needsFull || busy !== null}
          className="rounded-full bg-sun px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
        >
          ▶ {busy === "run" ? t(lang, "labRunning") : t(lang, "labRun")}
        </button>
        <button
          type="button"
          onClick={() => void doCheck()}
          disabled={!ready || busy !== null}
          className="rounded-full border border-[#362c25] px-3 py-1.5 text-xs text-[#e9ddcf] disabled:opacity-40"
        >
          {t(lang, "labCheck")}
        </button>
        <button
          type="button"
          onClick={() => void doReset()}
          disabled={!ready || busy !== null}
          className="rounded-full border border-[#362c25] px-3 py-1.5 text-xs text-[#b3a597] disabled:opacity-40"
        >
          {busy === "reset" ? t(lang, "labResetting") : t(lang, "labResetLesson")}
        </button>
        <button
          type="button"
          onClick={() => edit(exercise.starter[tab] ?? "")}
          className="rounded-full px-2 py-1.5 text-xs text-[#9c8a78] underline"
        >
          {t(lang, "labRestore")}
        </button>
        {passed && <span className="ml-auto text-xs font-semibold text-teal-400">✓ {t(lang, "labAllPassed")}</span>}
      </div>

      {needsFull && <p className="mt-2 text-xs text-dawn">{t(lang, "labNeedsFull")}</p>}
      {!ready && <p className="mt-2 text-xs text-[#b3a597] md:hidden">{t(lang, "labUseLaptop")}</p>}
      {note && (
        <p className="mt-2 text-xs text-[#ffd9c4]" aria-live="polite">
          {note}
        </p>
      )}

      {output && (
        <>
          <p className="mt-3 text-[11px] text-[#9c8a78]">
            {t(lang, "labOutput")} · exit {output.exitCode} · {output.ms} ms
          </p>
          <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-[#0c0a09] p-3 font-mono text-xs whitespace-pre-wrap text-[#cdbfb1]">
            {output.stdout}
            {output.stderr && <span className="text-[#ff8a4c]">{output.stderr}</span>}
            {output.timedOut && <span className="text-[#ff8a4c]">{"\n" + t(lang, "labTimedOut")}</span>}
          </pre>
        </>
      )}

      {checks && (
        <>
          <p className="mt-3 text-[11px] text-[#9c8a78]">{t(lang, "labChecks")}</p>
          <ul className="mt-1 space-y-0.5 rounded-lg bg-[#1e1916] p-3 text-xs" aria-live="polite">
            {checks.map((c) => (
              <li key={c.id} className={c.pass ? "text-teal-400" : "text-[#ff8a4c]"}>
                {c.pass ? "✓" : "○"} {c.label[lang]}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
