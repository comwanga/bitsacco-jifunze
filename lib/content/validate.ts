import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { LANGS, type Lang } from "../i18n.ts";
import { mp4DurationSeconds } from "./mp4.ts";
import {
  ExerciseFileSchema,
  GlossarySchema,
  LessonFrontmatterSchema,
  LibrarySchema,
  WorldGroupsSchema,
  QuizFileSchema,
  ROADMAP_IDS,
  RoadmapSchema,
  BLOG_CATEGORY_IDS,
  BlogCategoriesSchema,
  BlogEntrySchema,
  BlogFrontmatterSchema,
  type GlossaryTerm,
  type Roadmap,
} from "./schemas.ts";

export type Issue = {
  level: "error" | "warning";
  rule: 1 | 2 | 3 | 4 | 5 | 6 | 7;
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

  const worldFile = path.join(root, "world-groups.json");
  if (fs.existsSync(worldFile)) {
    const raw = readJsonSafe(worldFile, issues, root, 2);
    const world = WorldGroupsSchema.safeParse(raw);
    if (raw !== undefined && !world.success) issues.push({ level: "error", rule: 2, file: rel(root, worldFile), message: world.error.message });
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

  validateBlog(root, lessonKeys, issues);

  return issues;
}

const BLOG_IMAGE_MAX = 400 * 1024;
const VIDEO_MAX = 10 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 120;

/** Rule 7: blog posts. Messages are written for post writers, naming the field and the fix. */
function validateBlog(root: string, lessonKeys: Set<string>, issues: Issue[]): void {
  const dir = path.join(root, "blog");
  if (!fs.existsSync(dir)) return;
  const err = (file: string, message: string) => issues.push({ level: "error", rule: 7, file: rel(root, file), message });
  const registryFile = path.join(dir, "posts.json");
  const categoriesFile = path.join(dir, "categories.json");
  if (fs.existsSync(categoriesFile)) {
    const parsed = BlogCategoriesSchema.safeParse(readJsonSafe(categoriesFile, issues, root, 7));
    if (!parsed.success) err(categoriesFile, `categories.json: ${parsed.error.message}`);
  }
  const raw = fs.existsSync(registryFile) ? readJsonSafe(registryFile, issues, root, 7) : [];
  if (!Array.isArray(raw)) { err(registryFile, "posts.json must be a list of posts"); return; }
  if (raw.length === 0) err(registryFile, "at least one post is required: the static build needs at least one post page");

  const publicFile = (site: string) => path.join(root, "..", "public", site);
  const checkImage = (file: string, site: string, what: string) => {
    if (!/^\/images\/blog\/[a-z0-9][a-z0-9-]*\.(webp|jpg|png|svg)$/.test(site)) return err(file, `${what} "${site}" must be a .webp, .jpg, .png or .svg file in /images/blog/`);
    if (!fs.existsSync(publicFile(site))) return err(file, `${what}: image file not found: add public${site}`);
    if (fs.statSync(publicFile(site)).size > BLOG_IMAGE_MAX) err(file, `${what}: public${site} is larger than 400 KB; make it smaller to save learners' mobile data`);
  };

  const listed = new Set<string>();
  for (const entry of raw as Record<string, unknown>[]) {
    const slug = typeof entry?.slug === "string" ? entry.slug : "(no slug)";
    if (listed.has(slug)) { err(registryFile, `duplicate slug "${slug}": each post needs its own slug`); continue; }
    listed.add(slug);
    if (typeof entry?.category === "string" && !(BLOG_CATEGORY_IDS as readonly string[]).includes(entry.category)) {
      err(registryFile, `${slug}: unknown category "${entry.category}"; use one of ${BLOG_CATEGORY_IDS.join(", ")}`);
    }
    const parsed = BlogEntrySchema.safeParse(entry);
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        if (problem.path[0] === "category") continue; // reported above in plain words
        err(registryFile, `${slug}: ${problem.path.join(".") || "entry"}: ${problem.message}`);
      }
      continue;
    }
    const post = parsed.data;
    if (post.updatedAt && post.updatedAt < post.publishedAt) err(registryFile, `${slug}: updatedAt is before publishedAt`);
    for (const lesson of post.relatedLessons) {
      if (!lessonKeys.has(lesson)) err(registryFile, `${slug}: related lesson "${lesson}" does not exist; use roadmap/slug of a real lesson`);
    }
    if (post.image) checkImage(registryFile, post.image, `${slug}: image`);

    const present = LANGS.filter((l) => fs.existsSync(path.join(dir, l, `${slug}.mdx`)));
    if (present.length === 0) err(registryFile, `${slug}: no Kiswahili or English file; add blog/sw/${slug}.mdx or blog/en/${slug}.mdx`);
    for (const lang of present) {
      const file = path.join(dir, lang, `${slug}.mdx`);
      let data: Record<string, unknown>, body: string;
      try {
        ({ data, content: body } = matter(fs.readFileSync(file, "utf8")));
      } catch (e) {
        err(file, `front matter could not be read: ${(e as Error).message}`);
        continue;
      }
      const fm = BlogFrontmatterSchema.safeParse(data);
      if (!fm.success) for (const problem of fm.error.issues) err(file, `${problem.path.join(".") || "front matter"}: ${problem.message}`);
      if (post.image && !data.imageAlt) err(file, "imageAlt is required because the post has an image; describe the image in this language");
      validateBlogBody(file, body, err, checkImage, publicFile);
    }
  }

  for (const lang of LANGS) {
    const langDir = path.join(dir, lang);
    if (!fs.existsSync(langDir)) continue;
    for (const name of fs.readdirSync(langDir)) {
      if (name.endsWith(".mdx") && !listed.has(name.slice(0, -4))) err(path.join(langDir, name), `"${name.slice(0, -4)}" is not listed in posts.json; add an entry for it`);
    }
  }
}

function validateBlogBody(
  file: string,
  body: string,
  err: (file: string, message: string) => void,
  checkImage: (file: string, site: string, what: string) => void,
  publicFile: (site: string) => string,
): void {
  const attr = (attrs: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
  for (const m of body.matchAll(/<Video\s([^>]*?)\/?>/g)) {
    const [src, poster, captions, title] = ["src", "poster", "captions", "title"].map((n) => attr(m[1], n));
    if (!title) err(file, 'video needs a title="…"');
    if (!poster) err(file, 'video needs a poster image: add poster="/images/blog/…"');
    else checkImage(file, poster, "video poster");
    if (!src || !/^\/videos\/blog\/[a-z0-9][a-z0-9-]*\.mp4$/.test(src)) err(file, "video src must be an .mp4 file in /videos/blog/");
    else if (!fs.existsSync(publicFile(src))) err(file, `video file not found: add public${src}`);
    else {
      const duration = mp4DurationSeconds(publicFile(src));
      if (duration === null) err(file, `video must be an MP4 (H.264/AAC): public${src} is not one`);
      else {
        if (fs.statSync(publicFile(src)).size > VIDEO_MAX) err(file, `video public${src} is larger than 10 MB; shorten or compress it`);
        if (duration > VIDEO_MAX_SECONDS) err(file, `video public${src} is longer than 2 minutes; link to longer videos with <VideoLink> instead`);
      }
    }
    if (!captions || !/^\/videos\/blog\/[a-z0-9][a-z0-9.-]*\.vtt$/.test(captions)) err(file, 'video needs captions: add captions="/videos/blog/….vtt"');
    else if (!fs.existsSync(publicFile(captions))) err(file, `captions file not found: add public${captions}`);
    else if (!fs.readFileSync(publicFile(captions), "utf8").replace(/^﻿/, "").startsWith("WEBVTT")) err(file, `captions must be a WebVTT file starting with WEBVTT: public${captions}`);
  }
  for (const m of body.matchAll(/<VideoLink\s([^>]*?)\/?>/g)) {
    const [href, poster, title, duration] = ["href", "poster", "title", "duration"].map((n) => attr(m[1], n));
    if (!title) err(file, 'video link needs a title="…"');
    if (!duration) err(file, 'video link needs a duration="m:ss"');
    if (!poster) err(file, 'video link needs a poster image: add poster="/images/blog/…"');
    else checkImage(file, poster, "video link poster");
    if (!href) err(file, "video link needs an https:// href");
    else {
      const problem = href.startsWith("/") ? `"${href}" must be an https:// address on the video site` : checkUrl(href);
      if (problem) err(file, `video link ${problem}`);
    }
  }
  if (/<Exercise\b/.test(body)) err(file, "labs are not allowed in posts; link to the lesson that has the lab instead");
  for (const m of body.matchAll(/<Diagram\b([^>]*)>([\s\S]*?)<\/Diagram>/g)) {
    const attrs = m[1];
    const src = /\bsrc="([^"]*)"/.exec(attrs)?.[1];
    if (!/\balt="[^"]+"/.test(attrs)) err(file, "diagram needs alt text: add alt=\"…\" describing the image");
    if (!src) err(file, "diagram needs src=\"/images/blog/…\"");
    else checkImage(file, src, "diagram");
    const markers = [...m[2].matchAll(/<Marker\b([^>]*)>([\s\S]*?)<\/Marker>/g)];
    if (markers.length === 0) err(file, "diagram needs at least one <Marker>");
    for (const [n, marker] of markers.entries()) {
      for (const [axis, pattern] of [["x", /\bx=\{(-?[\d.]+)\}/], ["y", /\by=\{(-?[\d.]+)\}/]] as const) {
        const value = Number(pattern.exec(marker[1])?.[1]);
        if (!Number.isFinite(value) || value < 0 || value > 100) err(file, `marker ${n + 1}: marker position must be 0–100 (${axis}={…} is a percentage of the image)`);
      }
      if (!/\btitle="[^"]+"/.test(marker[1])) err(file, `marker ${n + 1} needs a title`);
      if (!marker[2].trim()) err(file, `marker ${n + 1} needs explanation text`);
    }
  }
}
