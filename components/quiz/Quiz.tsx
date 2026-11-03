"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { LessonKey } from "@/lib/progress/model";
import { useProgress } from "@/lib/progress/useProgress";
import { quizPassed } from "@/lib/quiz/score";

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  answer: string;
  explanation: string;
};

export function Quiz({ lessonKey, lang, questions, completesLesson }: { lessonKey: LessonKey; lang: Lang; questions: QuizQuestion[]; completesLesson: boolean }) {
  const { progress, quiz, complete } = useProgress();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const best = progress.lessons[lessonKey]?.quiz;
  const q = questions[index];

  function check() {
    if (!picked) return;
    setChecked(true);
    if (picked === q.answer) setCorrect((c) => c + 1);
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPicked(null);
      setChecked(false);
      return;
    }
    setFinished(true);
    quiz(lessonKey, correct, questions.length);
    if (completesLesson && quizPassed(correct, questions.length)) complete(lessonKey);
  }

  function retry() {
    setIndex(0);
    setPicked(null);
    setChecked(false);
    setCorrect(0);
    setFinished(false);
  }

  return (
    <section className="my-10 rounded-2xl border-2 border-teal-600/40 p-5" aria-labelledby="quiz-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="quiz-title" className="text-xl font-bold">
          {t(lang, "quizTitle")}
        </h2>
        {best && (
          <span className="text-sm text-[var(--muted)]">
            {t(lang, "quizBest")}: {best.correct}/{best.total}
          </span>
        )}
      </div>

      {finished ? (
        <div className="mt-4" aria-live="polite">
          <p className="text-lg font-semibold">
            {t(lang, "quizResult")} {correct} {t(lang, "quizOf")} {questions.length}
          </p>
          <button type="button" onClick={retry} className="mt-4 rounded-full border border-teal-600 px-5 py-2 font-semibold text-teal-700 dark:text-teal-400">
            {t(lang, "quizRetry")}
          </button>
        </div>
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (checked) next();
            else check();
          }}
        >
          <fieldset>
            <legend className="text-[17px] font-semibold">
              <span className="block text-sm font-normal text-[var(--muted)]">
                {t(lang, "question")} {index + 1} {t(lang, "quizOf")} {questions.length}
              </span>
              {q.prompt}
            </legend>
            <div className="mt-3 space-y-2">
              {q.options.map((o) => {
                const state = checked ? (o.id === q.answer ? "right" : o.id === picked ? "wrong" : "idle") : picked === o.id ? "picked" : "idle";
                const cls = {
                  idle: "border-[var(--line)]",
                  picked: "border-teal-600 bg-teal-50 dark:bg-teal-900/30",
                  right: "border-teal-600 bg-teal-50 dark:bg-teal-900/30",
                  wrong: "border-sun bg-[#fff0e8] dark:bg-[#3d1a0c]",
                }[state];
                return (
                  <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2.5 ${cls}`}>
                    <input
                      type="radio"
                      name={q.id}
                      value={o.id}
                      checked={picked === o.id}
                      disabled={checked}
                      onChange={() => setPicked(o.id)}
                      className="mt-1 accent-teal-600"
                    />
                    <span>{o.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {checked && (
            <p className="mt-3" aria-live="polite">
              <strong>{picked === q.answer ? t(lang, "quizCorrect") : t(lang, "quizWrong")}</strong> {q.explanation}
            </p>
          )}

          <button
            type="submit"
            disabled={!picked}
            className="mt-4 rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white disabled:opacity-40"
          >
            {!checked ? t(lang, "quizCheck") : index + 1 < questions.length ? t(lang, "quizNext") : t(lang, "quizFinish")}
          </button>
        </form>
      )}
    </section>
  );
}
