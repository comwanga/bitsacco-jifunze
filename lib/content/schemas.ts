import { z } from "zod";

const LangSchema = z.enum(["sw", "en"]);
const LocalizedSchema = z.object({ sw: z.string().min(1), en: z.string().min(1) });
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slugs are lowercase words joined by hyphens");

export const ROADMAP_IDS = ["savers", "builders", "lightning"] as const;
export const RoadmapIdSchema = z.enum(ROADMAP_IDS);
export type RoadmapId = z.infer<typeof RoadmapIdSchema>;

export const RoadmapSchema = z.object({
  id: RoadmapIdSchema,
  title: LocalizedSchema,
  tagline: LocalizedSchema,
  description: LocalizedSchema,
  sections: z
    .array(
      z.object({
        id: slug,
        title: LocalizedSchema,
        lessons: z.array(z.object({ slug, prerequisites: z.array(slug).optional() })).min(1),
      }),
    )
    .min(1),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

export const ResourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  kind: z.enum(["article", "book", "video", "docs", "tool", "pdf", "community"]),
  language: LangSchema,
  note: z.string().optional(),
});
export type Resource = z.infer<typeof ResourceSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dates are YYYY-MM-DD");

export const SourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("original") }),
  z.object({
    type: z.literal("adapted"),
    from: z.string().min(1),
    url: z.string().min(1),
    licence: z.string().min(1),
    credit: z.string().min(1),
  }),
]);

export const LessonFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  minutes: z.number().int().positive(),
  objectives: z.array(z.string().min(1)).min(1),
  resources: z.array(ResourceSchema),
  reflection: z.array(z.string().min(1)).min(1),
  source: SourceSchema,
  translationOf: LangSchema.optional(),
  lastReviewed: isoDate.optional(),
  translationPending: z.boolean().optional(),
  terms: z.array(z.string()).optional(),
});
export type LessonFrontmatter = z.infer<typeof LessonFrontmatterSchema>;

export const QuizFileSchema = z.object({
  lesson: slug,
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: LocalizedSchema,
        options: z.array(z.object({ id: z.string().min(1), label: LocalizedSchema })).min(2),
        answer: z.string().min(1),
        explanation: LocalizedSchema,
      }),
    )
    .min(1),
});
export type QuizFile = z.infer<typeof QuizFileSchema>;

export const LAB_NODES = ["alice", "bob", "chan", "dina", "erin", "none"] as const;
export const LAB_TABS = ["cli", "python"] as const;

export const ExerciseFileSchema = z.object({
  id: slug,
  lesson: slug,
  title: LocalizedSchema,
  node: z.enum(LAB_NODES),
  tab: z.enum(LAB_TABS),
  profile: z.literal("full").optional(),
  starter: z.object({ cli: z.string().optional(), python: z.string().optional() }),
  solution: z.object({ cli: z.string().optional(), python: z.string().optional() }),
});
export type ExerciseFile = z.infer<typeof ExerciseFileSchema>;

export const GlossaryTermSchema = z.object({
  id: slug,
  sw: z.string().min(1),
  en: z.string().min(1),
  definition: LocalizedSchema,
});
export const GlossarySchema = z.array(GlossaryTermSchema);
export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

export const LibraryItemSchema = z.object({
  id: slug,
  title: LocalizedSchema,
  author: z.string().min(1),
  language: LangSchema,
  format: z.enum(["pdf", "online", "pending-pdf"]).default("pdf"),
  url: z.string().min(1).optional(),
  sizeBytes: z.number().int().positive().optional(),
  licence: z.string().min(1),
  credit: z.string().optional(),
  note: LocalizedSchema.optional(),
}).refine(item => item.format === "pending-pdf" ? item.url === undefined : Boolean(item.url), {
  message: "Available resources require a URL; pending PDFs must not advertise a download URL",
}).refine(item => item.format !== "pdf" || item.sizeBytes !== undefined, {
  message: "Available PDFs require a verified file size",
});
export const LibrarySchema = z.array(LibraryItemSchema);
export type LibraryItem = z.infer<typeof LibraryItemSchema>;
