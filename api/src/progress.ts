import { z } from "zod";
import { errorCode } from "./db.ts";
import { ApiError } from "./errors.ts";
import type { Route, Sql } from "./http.ts";
import { Limiter } from "./ratelimit.ts";

/*
 * Server copy of a learner's progress, in the same version 1 document the site keeps on the device.
 *
 * The account is always the session's. POST is a merge, never a replacement: it can only add what the document
 * knows (earliest completion, earliest discussion confirmation, best quiz, union of lab passes), with exactly the
 * rules of mergeProgress in lib/progress/model.ts. A stale tab, an old device or a replayed request therefore
 * cannot remove anything, and the order requests arrive in does not matter.
 *
 * Nothing here leaves the database: no relay, no outbound request, no public read.
 */

export const PROGRESS_BODY_BYTES = 64 * 1024;
export const MAX_LESSONS = 500;
export const MAX_LAB_PASSES = 100;
const MAX_QUIZ_TOTAL = 1000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

// Exactly what the site writes (Date.toISOString): UTC, milliseconds. The device compares these as text, the
// database as instants; only in this one form do the two orders agree, so nothing else is accepted.
const CANONICAL = /^2\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const timestamp = z.string().refine((s) => {
  if (!CANONICAL.test(s)) return false;
  const t = Date.parse(s);
  // A real calendar instant, and not from the future: a wrong clock is refused, never silently rewritten.
  return !Number.isNaN(t) && new Date(t).toISOString() === s && t <= Date.now() + FUTURE_TOLERANCE_MS;
});
const quiz = z.object({
  correct: z.number().int().min(0).max(MAX_QUIZ_TOTAL),
  total: z.number().int().min(0).max(MAX_QUIZ_TOTAL),
  at: timestamp,
}).strict().refine((q) => q.correct <= q.total);
const lab = z.object({
  passed: z.array(z.string().max(64).refine((id) => !id.includes("\u0000"))).max(MAX_LAB_PASSES),
}).strict();
const lesson = z.object({
  completedAt: timestamp.optional(),
  reflectedAt: timestamp.optional(),
  quiz: quiz.optional(),
  lab: lab.optional(),
}).strict();
const LESSON_KEY = /^(savers|builders|lightning)\/[a-z0-9-]{1,80}$/;
/** A version 1 progress document. `exportedAt` is what an export file carries; it is accepted and ignored. */
export const progressBody = z.object({
  app: z.literal("bitsacco-jifunze"),
  version: z.literal(1),
  lessons: z.record(z.string().regex(LESSON_KEY), lesson).refine((l) => Object.keys(l).length <= MAX_LESSONS),
  exportedAt: z.string().max(40).optional(),
}).strict();
type Document = z.infer<typeof progressBody>;
type Lesson = z.infer<typeof lesson>;

type Row = {
  lesson_key: string; completed_at: Date | null; reflected_at: Date | null;
  quiz_correct: number | null; quiz_total: number | null; quiz_at: Date | null; lab_passed: string[];
};

async function read(sql: Sql, accountId: string): Promise<{ app: "bitsacco-jifunze"; version: 1; lessons: Record<string, Lesson> }> {
  const rows = await sql<Row[]>`
    select lesson_key, completed_at, reflected_at, quiz_correct, quiz_total, quiz_at, lab_passed
    from lesson_progress where account_id = ${accountId} order by lesson_key`;
  const lessons: Record<string, Lesson> = {};
  for (const r of rows) {
    const l: Lesson = {};
    if (r.completed_at) l.completedAt = r.completed_at.toISOString();
    if (r.reflected_at) l.reflectedAt = r.reflected_at.toISOString();
    if (r.quiz_at) l.quiz = { correct: r.quiz_correct!, total: r.quiz_total!, at: r.quiz_at.toISOString() };
    if (r.lab_passed.length > 0) l.lab = { passed: r.lab_passed };
    lessons[r.lesson_key] = l;
  }
  return { app: "bitsacco-jifunze", version: 1, lessons };
}

/**
 * One statement merges every lesson of the document, each under its row lock, in key order. `keep` is true when the
 * stored quiz stays: a higher ratio wins (a total of 0 counts as ratio 0, compared without division), then the
 * earlier attempt, then the larger total. It is the same total order as better() on the device.
 */
async function merge(sql: Sql, accountId: string, doc: Document): Promise<Awaited<ReturnType<typeof read>>> {
  const rows = Object.keys(doc.lessons).sort().flatMap((key) => {
    const l = doc.lessons[key]!;
    const passed = [...new Set(l.lab?.passed ?? [])];
    if (!l.completedAt && !l.reflectedAt && !l.quiz && passed.length === 0) return []; // an empty entry holds nothing
    return [{
      lesson_key: key, completed_at: l.completedAt ?? null, reflected_at: l.reflectedAt ?? null,
      quiz_correct: l.quiz?.correct ?? null, quiz_total: l.quiz?.total ?? null, quiz_at: l.quiz?.at ?? null, lab_passed: passed,
    }];
  });
  try {
    return await sql.begin(async (tx) => {
      // One writer per account at a time, without touching the account row that sign-in and recovery lock.
      await tx`select pg_advisory_xact_lock(hashtextextended(${accountId}, 0))`;
      if (rows.length > 0) {
        const keep = tx`(excluded.quiz_at is null or (p.quiz_at is not null and (
          (case when p.quiz_total > 0 then p.quiz_correct else 0 end)::bigint * (case when excluded.quiz_total > 0 then excluded.quiz_total else 1 end)
            > (case when excluded.quiz_total > 0 then excluded.quiz_correct else 0 end)::bigint * (case when p.quiz_total > 0 then p.quiz_total else 1 end)
          or ((case when p.quiz_total > 0 then p.quiz_correct else 0 end)::bigint * (case when excluded.quiz_total > 0 then excluded.quiz_total else 1 end)
            = (case when excluded.quiz_total > 0 then excluded.quiz_correct else 0 end)::bigint * (case when p.quiz_total > 0 then p.quiz_total else 1 end)
            and (p.quiz_at < excluded.quiz_at or (p.quiz_at = excluded.quiz_at and p.quiz_total >= excluded.quiz_total))))))`;
        await tx`
          insert into lesson_progress as p (account_id, lesson_key, completed_at, reflected_at, quiz_correct, quiz_total, quiz_at, lab_passed)
          select ${accountId}::uuid, x.lesson_key, x.completed_at::timestamptz, x.reflected_at::timestamptz,
                 x.quiz_correct, x.quiz_total, x.quiz_at::timestamptz, coalesce(x.lab_passed, '{}')
          from jsonb_to_recordset(${tx.json(rows)}::jsonb) as x(
            lesson_key text, completed_at text, reflected_at text, quiz_correct smallint, quiz_total smallint, quiz_at text, lab_passed text[])
          order by x.lesson_key
          on conflict (account_id, lesson_key) do update set
            completed_at = least(p.completed_at, excluded.completed_at),
            reflected_at = least(p.reflected_at, excluded.reflected_at),
            quiz_correct = case when ${keep} then p.quiz_correct else excluded.quiz_correct end,
            quiz_total   = case when ${keep} then p.quiz_total   else excluded.quiz_total   end,
            quiz_at      = case when ${keep} then p.quiz_at      else excluded.quiz_at      end,
            lab_passed   = (select coalesce(array_agg(distinct x order by x), '{}') from unnest(p.lab_passed || excluded.lab_passed) x),
            updated_at   = now()`;
        const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from lesson_progress where account_id = ${accountId}`;
        if (n > MAX_LESSONS) throw new ApiError(400, "bad_request"); // rolls the whole merge back
      }
      return read(tx, accountId);
    });
  } catch (e) {
    // 23514: the merged lab passes of a lesson exceed the limit. 23503: the account was deleted meanwhile.
    if (errorCode(e) === "23514") throw new ApiError(400, "bad_request");
    if (errorCode(e) === "23503") throw new ApiError(401, "unauthenticated");
    throw e;
  }
}

const perAccount = (name: string, limit: number) => new Limiter([{ name, key: (accountId) => accountId, limit, windowMs: 60_000 }]);

export function progressRoutes(reads = perAccount("progress-read", 120), writes = perAccount("progress-write", 60)): Route[] {
  return [{
    // A full session only: the router refuses a recovery session before this runs.
    method: "GET", path: "/api/me/progress", auth: "full",
    handler: async ({ sql, session }) => {
      if (!reads.hit(session!.accountId)) throw new ApiError(429, "rate_limited");
      return { status: 200, json: await read(sql, session!.accountId) };
    },
  }, {
    method: "POST", path: "/api/me/progress", auth: "full", body: progressBody, maxBodyBytes: PROGRESS_BODY_BYTES,
    handler: async ({ sql, session, body }) => {
      if (!writes.hit(session!.accountId)) throw new ApiError(429, "rate_limited");
      return { status: 200, json: await merge(sql, session!.accountId, body as Document) };
    },
  }];
}
