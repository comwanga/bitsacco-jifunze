import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { LANGS, type Lang } from "../i18n.ts";
import {
  ExerciseFileSchema,
  GlossarySchema,
  LessonFrontmatterSchema,
  LibrarySchema,
  QuizFileSchema,
  ROADMAP_IDS,
  RoadmapSchema,
  type GlossaryTerm,
  type Roadmap,
} from "./schemas.ts";

export type Issue = {
  level: "error" | "warning";
  rule: 1 | 2 | 3 | 4 | 5 | 6;
  file: string;
  message: string;
};

export type ValidateOptions = {
  /** Where lab check modules live; defaults to <repo>/lab/jifunze_lab/checks next to content/. */
  checksDir?: string;
};

function checkIdsIn(dir: string): Set<string> {
  const ids = new Set<string>();
  if (!fs.existsSync(dir)) return ids;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".py"))) {
    for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/"([a-z0-9]+(?:-[a-z0-9]+)*)"\s*:/g)) {
      ids.add(m[1]);
    }
  }
  return ids;
}

// Rule 6: every <Exercise id> has an exercise file for this lesson, a starter for its tab, a check
// in the lab, and (warning) a model solution.
function validateExercises(root: string, roadmap: Roadmap, checks: Set<string>, issues: Issue[]): void {
  for (const slug of roadmap.sections.flatMap((s) => s.lessons.map((l) => l.slug))) {
    for (const lang of LANGS) {
      const lessonFile = path.join(root, roadmap.id, lang, `${slug}.mdx`);
      if (!fs.existsSync(lessonFile)) continue;
      const where = rel(root, lessonFile);
      for (const m of fs.readFileSync(lessonFile, "utf8").matchAll(/<Exercise\s+id="([^"]+)"/g)) {
        const id = m[1];
        const file = path.join(root, roadmap.id, "exercises", `${id}.json`);
        if (!fs.existsSync(file)) {
          issues.push({ level: "error", rule: 6, file: where, message: `<Exercise id="${id}"> has no exercises/${id}.json` });
          continue;
        }
        let raw: unknown;
        try {
          raw = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (e) {
          issues.push({ level: "error", rule: 6, file: rel(root, file), message: `cannot read JSON: ${(e as Error).message}` });
          continue;
        }
        const parsed = ExerciseFileSchema.safeParse(raw);
        if (!parsed.success) {
          issues.push({ level: "error", rule: 6, file: rel(root, file), message: parsed.error.message });
          continue;
        }
        const ex = parsed.data;
        if (lang !== "sw") continue; // file-level checks once per lesson, not once per language
        const exWhere = rel(root, file);
        if (ex.id !== id) issues.push({ level: "error", rule: 6, file: exWhere, message: `id "${ex.id}" must be "${id}"` });
        if (ex.lesson !== slug) {
          issues.push({ level: "error", rule: 6, file: exWhere, message: `${id}: lesson is "${ex.lesson}" but it is used in "${slug}"` });
        }
        if (!ex.starter[ex.tab]) {
          issues.push({ level: "error", rule: 6, file: exWhere, message: `${id}: no starter for its "${ex.tab}" tab` });
        }
        if (!checks.has(id)) {
          issues.push({ level: "error", rule: 6, file: exWhere, message: `${id}: no check in lab/jifunze_lab/checks` });
        }
        if (!ex.solution[ex.tab]) {
          issues.push({ level: "warning", rule: 6, file: exWhere, message: `${id}: no model solution for reviewers and the smoke test` });
        }
      }
    }
  }
}

const ADAPTED_FIELDS = ["from", "url", "licence", "credit"] as const;

function rel(root: string, file: string): string {
  return path.relative(root, file).replaceAll("\\", "/");
}

export function checkUrl(url: string): string | null {
  if (url.startsWith("/") && !url.startsWith("//")) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `"${url}" is not a well-formed URL`;
  }
  if (parsed.protocol !== "https:") return `"${url}" must use https`;
  return null;
}

function stripCode(body: string): string {
  return body.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJsonSafe(file: string, issues: Issue[], root: string, rule: Issue["rule"]): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    issues.push({ level: "error", rule, file: rel(root, file), message: `cannot read JSON: ${(e as Error).message}` });
    return undefined;
  }
}

function validateLessonFile(
  root: string,
  file: string,
  lang: Lang,
  glossary: GlossaryTerm[],
  issues: Issue[],
): void {
  const where = rel(root, file);
  let data: Record<string, unknown>;
  let body: string;
  try {
    const parsed = matter(fs.readFileSync(file, "utf8"));
    data = parsed.data;
    body = parsed.content;
  } catch (e) {
    issues.push({ level: "error", rule: 2, file: where, message: `cannot parse front matter: ${(e as Error).message}` });
    return;
  }

  // Rule 4: adapted lessons must name source and licence.
  const source = data.source as Record<string, unknown> | undefined;
  if (source && source.type === "adapted") {
    const missing = ADAPTED_FIELDS.filter((f) => typeof source[f] !== "string" || source[f] === "");
    if (missing.length > 0) {
      issues.push({ level: "error", rule: 4, file: where, message: `adapted lesson must set source.${missing.join(", source.")}` });
    }
  }

  // Rule 2: front matter schema (source problems are reported under rule 4).
  const result = LessonFrontmatterSchema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      if (issue.path[0] === "source" && source?.type === "adapted") continue;
      issues.push({ level: "error", rule: 2, file: where, message: `${issue.path.join(".") || "front matter"}: ${issue.message}` });
    }
  }
  if (!data.lastReviewed) {
    issues.push({ level: "warning", rule: 2, file: where, message: "no lastReviewed date yet (draft until a reviewer signs off)" });
  }

  // Rule 3: resource links are well formed.
  const resources = Array.isArray(data.resources) ? (data.resources as Record<string, unknown>[]) : [];
  for (const r of resources) {
    if (typeof r?.url !== "string") continue;
    const problem = checkUrl(r.url);
    if (problem) issues.push({ level: "error", rule: 3, file: where, message: `resource ${problem}` });
  }

  // Rule 5: glossary consistency (warnings only).
  const ids = new Set(glossary.map((g) => g.id));
  const terms = Array.isArray(data.terms) ? (data.terms as unknown[]) : [];
  for (const term of terms) {
    if (typeof term === "string" && !ids.has(term)) {
      issues.push({ level: "warning", rule: 5, file: where, message: `terms: "${term}" is not in glossary.json` });
    }
  }
  for (const m of body.matchAll(/<Term\s+id="([^"]+)"/g)) {
    if (!ids.has(m[1])) {
      issues.push({ level: "warning", rule: 5, file: where, message: `<Term id="${m[1]}"> is not in glossary.json` });
    }
  }
  if (lang === "sw") {
    // Tag names and attributes (e.g. <Term id="node">, <Callout type="scam">) are not prose.
    const prose = stripCode(body).replace(/<\/?[A-Za-z][^>]*>/g, " ");
    for (const g of glossary) {
      if (g.en.toLowerCase() === g.sw.toLowerCase()) continue;
      const re = new RegExp(`(^|[^\\p{L}])${escapeRegExp(g.en)}(?=$|[^\\p{L}])`, "iu");
      if (re.test(prose)) {
        issues.push({
          level: "warning",
          rule: 5,
          file: where,
          message: `uses English "${g.en}"; the glossary term is "${g.sw}"`,
        });
      }
    }
  }
}

export function validateContent(root: string, opts: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];

  const glossaryFile = path.join(root, "glossary.json");
  const glossaryRaw = readJsonSafe(glossaryFile, issues, root, 2);
  const glossaryParsed = GlossarySchema.safeParse(glossaryRaw);
  const glossary = glossaryParsed.success ? glossaryParsed.data : [];
  if (glossaryRaw !== undefined && !glossaryParsed.success) {
    issues.push({ level: "error", rule: 2, file: rel(root, glossaryFile), message: glossaryParsed.error.message });
  }
  if (glossaryParsed.success) {
    const seen = new Set<string>();
    for (const g of glossary) {
      if (seen.has(g.id)) issues.push({ level: "error", rule: 2, file: rel(root, glossaryFile), message: `duplicate id "${g.id}"` });
      seen.add(g.id);
    }
  }

  const libraryFile = path.join(root, "library.json");
  if (fs.existsSync(libraryFile)) {
    const raw = readJsonSafe(libraryFile, issues, root, 2);
    const lib = LibrarySchema.safeParse(raw);
    if (raw !== undefined && !lib.success) {
      issues.push({ level: "error", rule: 2, file: rel(root, libraryFile), message: lib.error.message });
    } else if (lib.success) {
      for (const item of lib.data) {
        // A tightly constrained local static PDF is also a valid library resource.
        // Lesson reference URL validation is unchanged.
        const localPdf = item.format === "pdf" && /^\/books\/[a-z0-9-]+\.pdf$/.test(item.url ?? "");
        let problem = item.url && !localPdf ? checkUrl(item.url) : null;
        if (localPdf) {
          const file = path.join(root, "..", "public", item.url!);
          if (!fs.existsSync(file) || fs.statSync(file).size !== item.sizeBytes) problem = "local PDF missing or file size differs from library metadata";
        }
        if (problem) issues.push({ level: "error", rule: 3, file: rel(root, libraryFile), message: `${item.id}: ${problem}` });
      }
    }
  }

  const roadmaps: Roadmap[] = [];
  for (const id of ROADMAP_IDS) {
    const file = path.join(root, "roadmaps", `${id}.json`);
    if (!fs.existsSync(file)) continue;
    const raw = readJsonSafe(file, issues, root, 2);
    const parsed = RoadmapSchema.safeParse(raw);
    if (!parsed.success) {
      if (raw !== undefined) issues.push({ level: "error", rule: 2, file: rel(root, file), message: parsed.error.message });
      continue;
    }
    if (parsed.data.id !== id) {
      issues.push({ level: "error", rule: 2, file: rel(root, file), message: `id "${parsed.data.id}" must match file name "${id}"` });
    }
    roadmaps.push(parsed.data);
  }

  const lessonKeys = new Set<string>();
  for (const roadmap of roadmaps) {
    const roadmapFile = rel(root, path.join(root, "roadmaps", `${roadmap.id}.json`));
    const slugs = roadmap.sections.flatMap((s) => s.lessons.map((l) => l.slug));
    const slugSet = new Set(slugs);
    if (slugSet.size !== slugs.length) {
      issues.push({ level: "error", rule: 2, file: roadmapFile, message: "a lesson slug appears more than once" });
    }

    const sectionIds = new Set<string>();
    for (const section of roadmap.sections) {
      if (sectionIds.has(section.id)) issues.push({ level: "error", rule: 2, file: roadmapFile, message: `duplicate section id "${section.id}"` });
      sectionIds.add(section.id);
    }
    // Existence alone is insufficient: a cyclic reading order can never be satisfied.
    const prerequisites = new Map(roadmap.sections.flatMap((s) => s.lessons).map((l) => [l.slug, l.prerequisites ?? []]));
    const visited = new Set<string>();
    const visiting: string[] = [];
    function visit(slug: string): void {
      const cycleStart = visiting.indexOf(slug);
      if (cycleStart !== -1) {
        issues.push({ level: "error", rule: 2, file: roadmapFile, message: `prerequisite cycle: ${[...visiting.slice(cycleStart), slug].join(" -> ")}` });
        return;
      }
      if (visited.has(slug) || !slugSet.has(slug)) return;
      visiting.push(slug);
      for (const pre of prerequisites.get(slug) ?? []) visit(pre);
      visiting.pop();
      visited.add(slug);
    }
    for (const slug of slugs) visit(slug);

    for (const section of roadmap.sections) {
      for (const entry of section.lessons) {
        lessonKeys.add(`${roadmap.id}/${entry.slug}`);
        for (const pre of entry.prerequisites ?? []) {
          if (!slugSet.has(pre)) {
            issues.push({ level: "error", rule: 2, file: roadmapFile, message: `${entry.slug}: prerequisite "${pre}" is not a lesson in this roadmap` });
          }
        }

        const present = LANGS.filter((l) => fs.existsSync(path.join(root, roadmap.id, l, `${entry.slug}.mdx`)));
        if (present.length === 0) {
          issues.push({ level: "error", rule: 2, file: roadmapFile, message: `lesson "${entry.slug}" has no file in any language` });
          continue;
        }
        for (const lang of present) {
          validateLessonFile(root, path.join(root, roadmap.id, lang, `${entry.slug}.mdx`), lang, glossary, issues);
        }
        if (present.length === 1) {
          const file = path.join(root, roadmap.id, present[0], `${entry.slug}.mdx`);
          let pending = false;
          try {
            pending = matter(fs.readFileSync(file, "utf8")).data.translationPending === true;
          } catch {
            /* reported by validateLessonFile */
          }
          const missing = LANGS.find((l) => l !== present[0]);
          if (!pending) {
            issues.push({
              level: "error",
              rule: 1,
              file: rel(root, file),
              message: `no ${missing} translation; add ${roadmap.id}/${missing}/${entry.slug}.mdx or set translationPending: true`,
            });
          }
        }
      }
    }

    // Lesson files that no roadmap points to.
    for (const lang of LANGS) {
      const dir = path.join(root, roadmap.id, lang);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".mdx") && !slugSet.has(f.slice(0, -4))) {
          issues.push({ level: "warning", rule: 2, file: rel(root, path.join(dir, f)), message: "not listed in the roadmap, so readers can't reach it" });
        }
      }
    }
  }

  // Rule 3: quizzes.
  const quizRoot = path.join(root, "quizzes");
  if (fs.existsSync(quizRoot)) {
    for (const roadmapDir of fs.readdirSync(quizRoot)) {
      const dir = path.join(quizRoot, roadmapDir);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
        const file = path.join(dir, f);
        const where = rel(root, file);
        const slug = f.slice(0, -5);
        const raw = readJsonSafe(file, issues, root, 3);
        if (raw === undefined) continue;
        const parsed = QuizFileSchema.safeParse(raw);
        if (!parsed.success) {
          issues.push({ level: "error", rule: 3, file: where, message: parsed.error.message });
          continue;
        }
        const quiz = parsed.data;
        if (quiz.lesson !== slug) {
          issues.push({ level: "error", rule: 3, file: where, message: `lesson "${quiz.lesson}" must match file name "${slug}"` });
        }
        if (!lessonKeys.has(`${roadmapDir}/${slug}`)) {
          issues.push({ level: "error", rule: 3, file: where, message: `no lesson "${roadmapDir}/${slug}" in any roadmap` });
        }
        const qids = new Set<string>();
        for (const q of quiz.questions) {
          if (qids.has(q.id)) issues.push({ level: "error", rule: 3, file: where, message: `duplicate question id "${q.id}"` });
          qids.add(q.id);
          const optionIds = q.options.map((o) => o.id);
          if (new Set(optionIds).size !== optionIds.length) {
            issues.push({ level: "error", rule: 3, file: where, message: `${q.id}: duplicate option ids` });
          }
          if (!optionIds.includes(q.answer)) {
            issues.push({ level: "error", rule: 3, file: where, message: `${q.id}: answer "${q.answer}" is not one of the options` });
          }
        }
      }
    }
  }

  const checks = checkIdsIn(opts.checksDir ?? path.join(root, "..", "lab", "jifunze_lab", "checks"));
  for (const roadmap of roadmaps) validateExercises(root, roadmap, checks, issues);

  return issues;
}
