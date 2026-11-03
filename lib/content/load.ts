import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Lang } from "../i18n.ts";
import {
  ExerciseFileSchema,
  type ExerciseFile,
  GlossarySchema,
  LessonFrontmatterSchema,
  LibrarySchema,
  QuizFileSchema,
  ROADMAP_IDS,
  RoadmapSchema,
  type GlossaryTerm,
  type LessonFrontmatter,
  type LibraryItem,
  type QuizFile,
  type Roadmap,
  type RoadmapId,
} from "./schemas.ts";

// JIFUNZE_CONTENT_DIR lets tests and early builds point at a fixture tree.
export const CONTENT_ROOT = path.resolve(process.env.JIFUNZE_CONTENT_DIR ?? path.join(process.cwd(), "content"));

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function getRoadmap(id: RoadmapId, root: string = CONTENT_ROOT): Roadmap {
  return RoadmapSchema.parse(readJson(path.join(root, "roadmaps", `${id}.json`)));
}

export function listRoadmaps(root: string = CONTENT_ROOT): Roadmap[] {
  return ROADMAP_IDS.filter((id) => fs.existsSync(path.join(root, "roadmaps", `${id}.json`))).map((id) =>
    getRoadmap(id, root),
  );
}

export function flatLessons(roadmap: Roadmap): string[] {
  return roadmap.sections.flatMap((s) => s.lessons.map((l) => l.slug));
}

export type LoadedLesson = {
  roadmap: RoadmapId;
  slug: string;
  lang: Lang;
  servedLang: Lang;
  isFallback: boolean;
  frontmatter: LessonFrontmatter;
  body: string;
};

export function lessonPath(root: string, roadmap: RoadmapId, lang: Lang, slug: string): string {
  return path.join(root, roadmap, lang, `${slug}.mdx`);
}

export function parseLessonFile(file: string): { frontmatter: LessonFrontmatter; body: string } {
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const parsed = LessonFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid front matter in ${file}: ${parsed.error.message}`);
  }
  return { frontmatter: parsed.data, body: content };
}

export function getLesson(roadmap: RoadmapId, slug: string, lang: Lang, root: string = CONTENT_ROOT): LoadedLesson {
  const order: Lang[] = lang === "sw" ? ["sw", "en"] : ["en", "sw"];
  for (const served of order) {
    const file = lessonPath(root, roadmap, served, slug);
    if (fs.existsSync(file)) {
      const { frontmatter, body } = parseLessonFile(file);
      return { roadmap, slug, lang, servedLang: served, isFallback: served !== lang, frontmatter, body };
    }
  }
  throw new Error(`Lesson not found: ${roadmap}/${slug}`);
}

export function getQuiz(roadmap: RoadmapId, slug: string, root: string = CONTENT_ROOT): QuizFile | null {
  const file = path.join(root, "quizzes", roadmap, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return QuizFileSchema.parse(readJson(file));
}

export function exercisePath(id: string, root: string = CONTENT_ROOT, roadmap: RoadmapId = "lightning"): string {
  return path.join(root, roadmap, "exercises", `${id}.json`);
}

export function getExercise(id: string, root: string = CONTENT_ROOT, roadmap: RoadmapId = "lightning"): ExerciseFile {
  const file = exercisePath(id, root, roadmap);
  if (!fs.existsSync(file)) throw new Error(`Exercise not found: ${id}`);
  return ExerciseFileSchema.parse(readJson(file));
}

export function getGlossary(root: string = CONTENT_ROOT): GlossaryTerm[] {
  return GlossarySchema.parse(readJson(path.join(root, "glossary.json")));
}

export function getLibrary(root: string = CONTENT_ROOT): LibraryItem[] {
  return LibrarySchema.parse(readJson(path.join(root, "library.json")));
}
