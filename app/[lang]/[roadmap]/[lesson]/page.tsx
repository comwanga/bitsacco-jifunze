import type { Metadata } from "next";
import Link from "next/link";
import { MarkComplete } from "@/components/lesson/MarkComplete";
import { KeyTerms, Objectives, PrevNext, Reflection, Resources, SourceCredit } from "@/components/lesson/LessonParts";
import { Quiz } from "@/components/quiz/Quiz";
import { flatLessons, getGlossary, getLesson, getQuiz, getRoadmap, listRoadmaps } from "@/lib/content/load";
import { exerciseIds, renderLessonBody } from "@/lib/content/mdx";
import { LazyLabBar } from "@/components/lab/LabIslands";
import type { RoadmapId } from "@/lib/content/schemas";
import { t, type Lang } from "@/lib/i18n";
import { lessonKey } from "@/lib/progress/model";

export const dynamicParams = false;

// [roadmap] has no layout, so its params are not passed down; generate both segments here.
export function generateStaticParams() {
  return listRoadmaps().flatMap((r) => flatLessons(r).map((lesson) => ({ roadmap: r.id, lesson })));
}

type Params = { params: Promise<{ lang: string; roadmap: string; lesson: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, roadmap, lesson } = await params;
  const l = getLesson(roadmap as RoadmapId, lesson, lang as Lang);
  return { title: l.frontmatter.title, description: l.frontmatter.description };
}

export default async function LessonPage({ params }: Params) {
  const { lang: l, roadmap: rid, lesson: slug } = await params;
  const lang = l as Lang;
  const roadmap = getRoadmap(rid as RoadmapId);
  const lesson = getLesson(roadmap.id, slug, lang);
  const fm = lesson.frontmatter;
  const glossary = getGlossary();
  const terms = (fm.terms ?? []).map((id) => glossary.find((g) => g.id === id)).filter((g) => g !== undefined);
  const key = lessonKey(roadmap.id, slug);
  const ids = exerciseIds(lesson.body);
  const body = await renderLessonBody(lesson.body, lesson.servedLang, glossary, { lessonKey: key, lesson: slug, exerciseIds: ids });
  const quizFile = getQuiz(roadmap.id, slug);
  const order = flatLessons(roadmap);
  const i = order.indexOf(slug);
  const neighbour = (s: string | undefined) =>
    s ? { href: `/${lang}/${roadmap.id}/${s}/`, title: getLesson(roadmap.id, s, lang).frontmatter.title } : undefined;
  const section = roadmap.sections.find((s) => s.lessons.some((x) => x.slug === slug))!;

  return (
    <article className={`mx-auto px-4 pt-6 pb-16 ${ids.length ? "max-w-[84ch]" : "max-w-[68ch]"}`} lang={lesson.servedLang}>
      {ids.length > 0 && (
        <div lang={lang}>
          <LazyLabBar lang={lang} />
        </div>
      )}
      <p className="text-sm text-[var(--muted)]" lang={lang}>
        <Link href={`/${lang}/${roadmap.id}/`} className="underline underline-offset-2 hover:text-[var(--fg)]">
          {roadmap.title[lang]}
        </Link>{" "}
        <span aria-hidden="true">/</span> {section.title[lang]}
      </p>
      <h1 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{fm.title}</h1>
      <p className="mt-2 text-lg text-[var(--muted)]">{fm.description}</p>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]" lang={lang}>
        <span>
          {fm.minutes} {t(lang, "minutes")}
        </span>
        <span>{t(lang, `level_${fm.level}`)}</span>
        <span>
          {i + 1} / {order.length}
        </span>
      </p>

      {lesson.isFallback && (
        <p className="mt-6 rounded-xl bg-dawn/20 p-4 text-[15px]" lang={lang} role="note">
          {t(lang, "translationNotice")}
        </p>
      )}
      {!fm.lastReviewed && (
        <p className="mt-4 text-sm text-[var(--muted)]" lang={lang}>
          {t(lang, "draftNotice")}
        </p>
      )}

      <Objectives lang={lang} items={fm.objectives} />
      <KeyTerms lang={lang} terms={terms} />

      <div className="lesson-body">{body}</div>

      <Reflection lang={lang} prompts={fm.reflection} />

      {quizFile && (
        <div lang={lang}>
          <Quiz
            lessonKey={key}
            lang={lang}
            questions={quizFile.questions.map((q) => ({
              id: q.id,
              prompt: q.prompt[lang],
              options: q.options.map((o) => ({ id: o.id, label: o.label[lang] })),
              answer: q.answer,
              explanation: q.explanation[lang],
            }))}
          />
        </div>
      )}

      <div lang={lang}>
        <MarkComplete lessonKey={key} lang={lang} />
      </div>
      <Resources lang={lang} items={fm.resources} />
      <SourceCredit lang={lang} fm={fm} />
      <div lang={lang}>
        <PrevNext lang={lang} prev={neighbour(order[i - 1])} next={neighbour(order[i + 1])} />
      </div>
    </article>
  );
}
