import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { emptyProgress, mergeProgress, parseProgressFile, type LessonProgress, type Progress } from "../../lib/progress/model.ts";
import { connect, migrate } from "../src/db.ts";
import { deleteAccountRoute } from "../src/delete-route.ts";
import { createServer, MAX_BODY_BYTES, PREAUTH_COOKIE, SESSION_COOKIE, type Route } from "../src/http.ts";
import { nostrRoutes } from "../src/nostr-routes.ts";
import { MAX_LAB_PASSES, MAX_LESSONS, PROGRESS_BODY_BYTES, progressRoutes } from "../src/progress.ts";
import { Limiter } from "../src/ratelimit.ts";
import { issueCodes, recoveryRoutes } from "../src/recovery.ts";
import { routes as appRoutes } from "../src/routes.ts";
import { logoutRoute, meRoute, readSession } from "../src/sessions.ts";
import { fakeConfig, ORIGIN, resetTestDb, testDatabaseUrl } from "./helpers.ts";
import { header, signedEvent, testKey } from "./nostr-helper.ts";

// Stage 2 of the Nostr-first design: the server copy of a learner's progress.

const sql = connect(testDatabaseUrl());
const logs: unknown[] = [];
const cfg = fakeConfig();
const unlimited = () => new Limiter([]);
const servers: { close: () => Promise<void> }[] = [];
async function serve(routes: Route[]): Promise<string> {
  const server = createServer(routes, { cfg, sql, readSession, log: (l) => logs.push(l), logError: (l) => logs.push(l) });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  servers.push({ close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const routesWith = (progress: Route[]): Route[] => [
  meRoute, logoutRoute, deleteAccountRoute(unlimited()), ...nostrRoutes(unlimited(), unlimited(), unlimited()), ...recoveryRoutes(unlimited()), ...progress,
];
const base = await serve(routesWith(progressRoutes(unlimited(), unlimited())));
afterAll(async () => {
  for (const s of servers) await s.close();
  await sql.end();
});
beforeEach(async () => {
  logs.length = 0;
  await resetTestDb(sql);
  await migrate(sql, new URL("../migrations/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
});

type Key = typeof testKey;
const key = (n: number) => new Uint8Array(32).fill(n) as Key; // test only
const pair = (r: Response, name: string) => r.headers.getSetCookie().find((c) => c.startsWith(name + "="))?.split(";")[0] ?? "";
function post(path: string, body: string, cookie = "", authorization?: string, at = base) {
  return fetch(at + path, { method: "POST", headers: { origin: ORIGIN, "X-Jifunze": "1", "Content-Type": "application/json", cookie, ...(authorization ? { authorization } : {}) }, body });
}
const get = (path: string, cookie = "", at = base) => fetch(at + path, { headers: { cookie } });
async function signIn(k: Key, at = base): Promise<{ cookie: string; accountId: string }> {
  const c = await post("/api/auth/nostr/challenge", JSON.stringify({ lang: "en" }), "", undefined, at);
  const b = await c.json() as { challengeId: string; nonce: string; url: string };
  const raw = JSON.stringify({ challengeId: b.challengeId, nonce: b.nonce });
  const r = await post("/api/auth/nostr/verify", raw, pair(c, PREAUTH_COOKIE), header(signedEvent(Buffer.from(raw), b.url, undefined, {}, [], k)), at);
  expect(r.status).toBe(200);
  const cookie = pair(r, SESSION_COOKIE);
  return { cookie, accountId: (await readSession(sql, cookie.split("=")[1]))!.accountId };
}

type Lessons = Record<string, LessonProgress>;
const doc = (lessons: Lessons): Progress => ({ ...emptyProgress(), lessons });
const send = (cookie: string, body: unknown, at = base) => post("/api/me/progress", typeof body === "string" ? body : JSON.stringify(body), cookie, undefined, at);
const stored = async (cookie: string, at = base) => (await (await get("/api/me/progress", cookie, at)).json()) as Progress;
/** Lab passes are a set and an empty entry holds nothing: compare documents on that basis. */
const canonical = (p: { lessons: Lessons }) =>
  JSON.stringify(Object.keys(p.lessons).sort().flatMap((k) => {
    const l = p.lessons[k]!;
    const row = [k, l.completedAt ?? null, l.reflectedAt ?? null, l.quiz ? [l.quiz.correct, l.quiz.total, l.quiz.at] : null, [...new Set(l.lab?.passed ?? [])].sort()];
    return l.completedAt || l.reflectedAt || l.quiz || (l.lab?.passed.length ?? 0) > 0 ? [row] : [];
  }));
const rowCount = async (accountId?: string) =>
  Number((accountId ? await sql`select count(*) as n from lesson_progress where account_id = ${accountId}` : await sql`select count(*) as n from lesson_progress`)[0]!.n);

const T = (day: number, ms = 0) => new Date(Date.UTC(2026, 9, day, 8, 0, 0, ms)).toISOString();
function generator(seed: number) {
  let s = seed;
  const rnd = (n: number): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
  const times = Array.from({ length: 5 }, (_, i) => T(1 + i, i * 7));
  const keys = ["savers/a", "savers/b", "builders/c", "lightning/d"];
  const labs = ["e1", "e2", "e3", "e4"];
  return (): Progress => {
    const lessons: Lessons = {};
    for (const k of keys) {
      if (rnd(4) === 0) continue;
      const l: LessonProgress = {};
      if (rnd(2)) l.completedAt = times[rnd(5)];
      if (rnd(2)) l.reflectedAt = times[rnd(5)];
      if (rnd(3)) { const total = rnd(5); l.quiz = { correct: total ? rnd(total + 1) : 0, total, at: times[rnd(5)]! }; }
      if (rnd(2)) l.lab = { passed: labs.filter(() => rnd(2)) };
      lessons[k] = l;
    }
    return doc(lessons);
  };
}

describe("reading and writing a learner's own progress", () => {
  it("starts empty, stores a version 1 document and returns the same format the site reads", async () => {
    const a = await signIn(key(21));
    expect(await stored(a.cookie)).toEqual({ app: "bitsacco-jifunze", version: 1, lessons: {} });
    const lessons: Lessons = {
      "savers/money-and-bitcoin": { completedAt: T(2), reflectedAt: T(1, 5), quiz: { correct: 3, total: 4, at: T(2, 9) } },
      "lightning/getting-started": { lab: { passed: ["b-open", "a-fund"] } },
      "builders/ship-a-tool": { completedAt: T(3) }, // a historical completion with no discussion timestamp
      "savers/scams": {}, // an empty entry stores nothing
    };
    const r = await send(a.cookie, { ...doc(lessons), exportedAt: T(4) }); // an export file is accepted as it is
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const merged = await r.json() as Progress;
    expect(merged).toEqual(await stored(a.cookie));
    expect(canonical(merged)).toBe(canonical(doc(lessons)));
    expect(merged.lessons["builders/ship-a-tool"]).toEqual({ completedAt: T(3) });
    expect(merged.lessons["savers/scams"]).toBeUndefined();
    // The response is a valid document for the site's own parser.
    const parsed = parseProgressFile(JSON.stringify(merged));
    expect(parsed.ok && canonical(parsed.progress)).toBe(canonical(doc(lessons)));
    expect(await rowCount(a.accountId)).toBe(3);
  });

  it("needs a full session: anonymous, expired, signed-out and recovery sessions are refused", async () => {
    const a = await signIn(key(21));
    await send(a.cookie, doc({ "savers/a": { completedAt: T(1) } }));
    for (const r of [await get("/api/me/progress"), await send("", doc({}))]) expect(r.status).toBe(401);
    // A recovery session reaches neither route.
    const codes = await issueCodes(sql, cfg, a.accountId, { initial: true });
    const second = await signIn(key(21)); // a live full session to keep using below
    const redeemed = await post("/api/auth/recovery", JSON.stringify({ code: codes[0] }));
    const recovery = pair(redeemed, SESSION_COOKIE);
    for (const r of [await get("/api/me/progress", recovery), await send(recovery, doc({ "savers/b": { completedAt: T(1) } }))]) {
      expect(r.status).toBe(403);
      expect(((await r.json()) as { error: { code: string } }).error.code).toBe("recovery_scope");
    }
    // Redeeming a code ended the full sessions too.
    expect((await get("/api/me/progress", second.cookie)).status).toBe(401);
    // Expired and signed-out sessions.
    const b = await signIn(key(22));
    await sql`update sessions set expires_at = now() - interval '1 second' where account_id = ${b.accountId}`;
    expect((await get("/api/me/progress", b.cookie)).status).toBe(401);
    expect((await send(b.cookie, doc({ "savers/a": { completedAt: T(1) } }))).status).toBe(401);
    const c = await signIn(key(23));
    await post("/api/auth/logout", "", c.cookie);
    expect((await send(c.cookie, doc({ "savers/a": { completedAt: T(1) } }))).status).toBe(401);
    expect(await rowCount()).toBe(1); // only the first, authorised write exists
  });

  it("one account can neither read nor change another account's progress", async () => {
    const a = await signIn(key(21)), b = await signIn(key(22));
    await send(a.cookie, doc({ "savers/a": { completedAt: T(1), quiz: { correct: 1, total: 4, at: T(1) } } }));
    expect((await stored(b.cookie)).lessons).toEqual({});
    await send(b.cookie, doc({ "savers/a": { completedAt: T(1, 1), quiz: { correct: 4, total: 4, at: T(2) } }, "savers/b": { completedAt: T(2) } }));
    expect((await stored(a.cookie)).lessons).toEqual({ "savers/a": { completedAt: T(1), quiz: { correct: 1, total: 4, at: T(1) } } });
    // No field can name an account: any extra field makes the document invalid.
    for (const extra of [{ accountId: a.accountId }, { account_id: a.accountId }, { account: a.accountId }]) {
      expect((await send(b.cookie, { ...doc({ "savers/c": { completedAt: T(1) } }), ...extra })).status).toBe(400);
    }
    expect((await get(`/api/me/progress?account=${a.accountId}`, b.cookie)).status).toBe(200);
    expect(Object.keys((await stored(b.cookie)).lessons).sort()).toEqual(["savers/a", "savers/b"]);
    expect((await get(`/api/accounts/${a.accountId}/progress`, b.cookie)).status).toBe(404);
    expect(await rowCount(a.accountId)).toBe(1);
    expect(await rowCount(b.accountId)).toBe(2);
  });
});

describe("the merge", () => {
  it("is exactly the device's mergeProgress, in either order, and repeating a request changes nothing", async () => {
    const next = generator(7);
    const a = await signIn(key(21)), b = await signIn(key(22));
    let ties = 0;
    for (let i = 0; i < 150; i++) {
      await sql`delete from lesson_progress`;
      const x = next(), y = next();
      for (const k of Object.keys(x.lessons)) {
        const qx = x.lessons[k]!.quiz, qy = y.lessons[k]?.quiz;
        if (qx && qy && qx.at === qy.at && qx.total !== qy.total && qx.correct * (qy.total || 1) === qy.correct * (qx.total || 1)) ties++;
      }
      await send(a.cookie, x);
      const forward = await (await send(a.cookie, y)).json() as Progress;
      await send(b.cookie, y);
      const reverse = await (await send(b.cookie, x)).json() as Progress;
      const want = canonical(mergeProgress(mergeProgress(emptyProgress(), x), y));
      expect(canonical(forward)).toBe(want);
      expect(canonical(reverse)).toBe(want); // reordered requests
      expect(canonical(await (await send(a.cookie, x)).json() as Progress)).toBe(want); // a stale document, replayed
      expect(canonical(await (await send(a.cookie, forward)).json() as Progress)).toBe(want); // its own result, again
    }
    expect(ties).toBeGreaterThan(0); // the equal-ratio, equal-time rule was exercised against the device code
  }, 180_000);

  it("an older or poorer document can never erase newer work", async () => {
    const a = await signIn(key(21));
    const full: Lessons = {
      "savers/a": { completedAt: T(2), reflectedAt: T(2), quiz: { correct: 4, total: 4, at: T(3) }, lab: { passed: ["e1", "e2", "e3"] } },
      "savers/b": { completedAt: T(5) },
    };
    await send(a.cookie, doc(full));
    const stale: Lessons[] = [
      {}, // an empty document
      { "savers/a": {} }, // the lesson with nothing in it
      { "savers/a": { completedAt: T(9), reflectedAt: T(9) } }, // later timestamps
      { "savers/a": { quiz: { correct: 0, total: 4, at: T(1) } } }, // a worse quiz, even though earlier
      { "savers/a": { quiz: { correct: 2, total: 2, at: T(4) } } }, // the same ratio, later
      { "savers/a": { lab: { passed: [] } } }, { "savers/a": { lab: { passed: ["e1"] } } }, // fewer lab passes
      { "savers/c": { quiz: { correct: 0, total: 0, at: T(1) } } }, // unrelated lesson
    ];
    for (const lessons of stale) expect((await send(a.cookie, doc(lessons))).status).toBe(200);
    const after = await stored(a.cookie);
    expect(after.lessons["savers/a"]).toEqual({ ...full["savers/a"], lab: { passed: ["e1", "e2", "e3"] } });
    expect(after.lessons["savers/b"]).toEqual(full["savers/b"]);
    // Newer work does still arrive: an earlier completion, a better quiz, one more lab pass.
    await send(a.cookie, doc({ "savers/a": { completedAt: T(1), quiz: { correct: 5, total: 5, at: T(3) }, lab: { passed: ["e4"] } } }));
    expect((await stored(a.cookie)).lessons["savers/a"]).toEqual({ completedAt: T(1), reflectedAt: T(2), quiz: { correct: 5, total: 5, at: T(3) }, lab: { passed: ["e1", "e2", "e3", "e4"] } });
  });

  it("two devices of one account converge whatever each one sends", async () => {
    const phone = await signIn(key(21)), laptop = await signIn(key(21));
    expect(phone.accountId).toBe(laptop.accountId);
    const p = doc({ "savers/a": { completedAt: T(3), lab: { passed: ["e1"] } }, "savers/b": { reflectedAt: T(2) } });
    const l = doc({ "savers/a": { completedAt: T(2), quiz: { correct: 1, total: 2, at: T(2) }, lab: { passed: ["e2"] } }, "lightning/d": { completedAt: T(4) } });
    const fromPhone = await (await send(phone.cookie, p)).json() as Progress;
    const fromLaptop = await (await send(laptop.cookie, l)).json() as Progress;
    const want = canonical(mergeProgress(p, l));
    expect(canonical(fromLaptop)).toBe(want);
    expect(canonical(mergeProgress(fromPhone, await stored(phone.cookie)))).toBe(want); // the phone catches up on its next read
    expect(canonical(await stored(laptop.cookie))).toBe(want);
  });

  it("parallel requests lose nothing", async () => {
    const next = generator(11);
    const devices = [await signIn(key(21)), await signIn(key(21)), await signIn(key(21))];
    for (let round = 0; round < 12; round++) {
      await sql`delete from lesson_progress`;
      const docs = Array.from({ length: 9 }, next);
      const replies = await Promise.all(docs.map((d, i) => send(devices[i % 3]!.cookie, d)));
      for (const r of replies) expect(r.status).toBe(200);
      const want = canonical(docs.reduce((acc, d) => mergeProgress(acc, d), emptyProgress()));
      expect(canonical(await stored(devices[0]!.cookie))).toBe(want);
    }
  }, 60_000);

  it("writes for different accounts in parallel stay separate", async () => {
    const next = generator(13);
    const accounts = [await signIn(key(21)), await signIn(key(22)), await signIn(key(23)), await signIn(key(24))];
    const docs = accounts.map(() => [next(), next(), next()]);
    await Promise.all(accounts.flatMap((acct, i) => docs[i]!.map((d) => send(acct.cookie, d))));
    for (const [i, acct] of accounts.entries()) {
      expect(canonical(await stored(acct.cookie))).toBe(canonical(docs[i]!.reduce((acc, d) => mergeProgress(acc, d), emptyProgress())));
    }
  });
});

describe("input validation", () => {
  const ok = { "savers/a": { completedAt: T(1) } };
  const invalid: [string, unknown][] = [
    ["another app", { app: "other", version: 1, lessons: ok }],
    ["an unsupported version", { app: "bitsacco-jifunze", version: 2, lessons: ok }],
    ["a missing version", { app: "bitsacco-jifunze", lessons: ok }],
    ["lessons that are not an object", { app: "bitsacco-jifunze", version: 1, lessons: [] }],
    ["an extra top-level field", { ...doc(ok), note: "x" }],
    ["an unknown roadmap", doc({ "other/a": { completedAt: T(1) } })],
    ["an upper-case slug", doc({ "savers/A": { completedAt: T(1) } })],
    ["a slug with a path", doc({ "savers/a/b": { completedAt: T(1) } })],
    ["a slug over 80 characters", doc({ ["savers/" + "a".repeat(81)]: { completedAt: T(1) } })],
    ["an extra lesson field", doc({ "savers/a": { completedAt: T(1), notes: "x" } as LessonProgress })],
    ["a timestamp with an offset", doc({ "savers/a": { completedAt: "2026-10-01T10:00:00.000+03:00" } })],
    ["a timestamp without milliseconds", doc({ "savers/a": { completedAt: "2026-10-01T10:00:00Z" } })],
    ["a date only", doc({ "savers/a": { completedAt: "2026-10-01" } })],
    ["an impossible date", doc({ "savers/a": { completedAt: "2026-13-45T10:00:00.000Z" } })],
    ["a rolled-over date", doc({ "savers/a": { completedAt: "2026-02-30T10:00:00.000Z" } })],
    ["an empty timestamp", doc({ "savers/a": { reflectedAt: "" } })],
    ["a numeric timestamp", doc({ "savers/a": { completedAt: 1790000000000 as unknown as string } })],
    ["a timestamp from the future", doc({ "savers/a": { completedAt: new Date(Date.now() + 10 * 60_000).toISOString() } })],
    ["a far-future quiz time", doc({ "savers/a": { quiz: { correct: 1, total: 1, at: "2999-01-01T00:00:00.000Z" } } })],
    ["more correct answers than questions", doc({ "savers/a": { quiz: { correct: 5, total: 4, at: T(1) } } })],
    ["a negative score", doc({ "savers/a": { quiz: { correct: -1, total: 4, at: T(1) } } })],
    ["a fractional score", doc({ "savers/a": { quiz: { correct: 1.5, total: 4, at: T(1) } } })],
    ["a quiz over the size limit", doc({ "savers/a": { quiz: { correct: 1, total: 1001, at: T(1) } } })],
    ["a quiz without a time", doc({ "savers/a": { quiz: { correct: 1, total: 4 } as LessonProgress["quiz"] } })],
    ["an extra quiz field", doc({ "savers/a": { quiz: { correct: 1, total: 4, at: T(1), answers: [1] } as LessonProgress["quiz"] } })],
    ["a lab identifier over 64 characters", doc({ "savers/a": { lab: { passed: ["x".repeat(65)] } } })],
    ["a lab identifier with a NUL", doc({ "savers/a": { lab: { passed: ["a\u0000b"] } } })],
    ["a non-string lab identifier", doc({ "savers/a": { lab: { passed: [1 as unknown as string] } } })],
    ["too many lab passes", doc({ "savers/a": { lab: { passed: Array.from({ length: MAX_LAB_PASSES + 1 }, (_, i) => "e" + i) } } })],
    ["too many lessons", doc(Object.fromEntries(Array.from({ length: MAX_LESSONS + 1 }, (_, i) => ["savers/l" + i, {}])))],
    ["a bare array", []],
    ["a bare string", "progress"],
  ];
  it.each(invalid)("refuses %s and stores nothing", async (_name, body) => {
    const a = await signIn(key(21));
    const r = await send(a.cookie, body);
    expect(r.status).toBe(400);
    expect(await rowCount()).toBe(0);
  });

  it("refuses malformed JSON, and applies its own size limit without widening anyone else's", async () => {
    const a = await signIn(key(21));
    expect((await send(a.cookie, "{not json")).status).toBe(400);
    // Larger than the general limit, inside this route's: accepted.
    const many = doc(Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`savers/lesson-${i}`, { completedAt: T(1), reflectedAt: T(1), quiz: { correct: 1, total: 2, at: T(1) } }])));
    const large = JSON.stringify(many);
    expect(large.length).toBeGreaterThan(MAX_BODY_BYTES);
    expect(large.length).toBeLessThan(PROGRESS_BODY_BYTES);
    expect((await send(a.cookie, large)).status).toBe(200);
    expect(await rowCount(a.accountId)).toBe(250);
    // Over this route's limit: refused before parsing.
    const oversized = JSON.stringify({ ...many, exportedAt: undefined, lessons: { ...many.lessons, "savers/pad": { lab: { passed: Array.from({ length: 100 }, (_, i) => "p".repeat(60) + i) } } }, padding: "x".repeat(PROGRESS_BODY_BYTES) });
    expect((await send(a.cookie, oversized)).status).toBe(413);
    // Every other route keeps the general limit.
    const other = await post("/api/auth/nostr/challenge", JSON.stringify({ lang: "en", returnTo: "x".repeat(MAX_BODY_BYTES) }));
    expect(other.status).toBe(413);
    expect(await rowCount(a.accountId)).toBe(250);
  });

  it("enforces the per-account limits on the merged result and rolls the whole request back", async () => {
    const a = await signIn(key(21));
    const labs = (from: number, n: number) => Array.from({ length: n }, (_, i) => "e" + (from + i));
    expect((await send(a.cookie, doc({ "savers/a": { lab: { passed: labs(0, 60) } }, "savers/b": { completedAt: T(1) } }))).status).toBe(200);
    // 60 stored + 60 new different ones would be 120 for one lesson: refused, and the other lesson in the same request is not applied either.
    const over = await send(a.cookie, doc({ "savers/a": { lab: { passed: labs(60, 60) } }, "savers/c": { completedAt: T(1) } }));
    expect(over.status).toBe(400);
    const after = await stored(a.cookie);
    expect(after.lessons["savers/a"]!.lab!.passed).toHaveLength(60);
    expect(after.lessons["savers/c"]).toBeUndefined();
    // Lessons: 300 stored + 300 different ones would be 600 rows.
    const block = (prefix: string) => doc(Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`builders/${prefix}-${i}`, { completedAt: T(1) }])));
    expect((await send(a.cookie, block("x"))).status).toBe(200);
    expect((await send(a.cookie, block("y"))).status).toBe(400);
    expect(await rowCount(a.accountId)).toBe(302);
    // The same lessons again are still fine: the limit counts rows, not requests.
    expect((await send(a.cookie, block("x"))).status).toBe(200);
  });
});

describe("limits, deletion and privacy", () => {
  it("rate limits per account, not per address", async () => {
    const perAccount = (limit: number) => new Limiter([{ name: "t", key: (id) => id, limit, windowMs: 60_000 }]);
    const at = await serve(routesWith(progressRoutes(perAccount(2), perAccount(2))));
    const a = await signIn(key(21), at), b = await signIn(key(22), at);
    const body = doc({ "savers/a": { completedAt: T(1) } });
    expect((await send(a.cookie, body, at)).status).toBe(200);
    expect((await send(a.cookie, body, at)).status).toBe(200);
    expect((await send(a.cookie, body, at)).status).toBe(429);
    expect((await send(b.cookie, body, at)).status).toBe(200); // same address, another account
    expect((await get("/api/me/progress", a.cookie, at)).status).toBe(200);
    expect((await get("/api/me/progress", a.cookie, at)).status).toBe(200);
    expect((await get("/api/me/progress", a.cookie, at)).status).toBe(429);
  });

  it("deleting an account removes its progress and nobody else's", async () => {
    const a = await signIn(key(21)), b = await signIn(key(22));
    await send(a.cookie, doc({ "savers/a": { completedAt: T(1) }, "savers/b": { completedAt: T(2) } }));
    await send(b.cookie, doc({ "savers/a": { completedAt: T(3) } }));
    expect((await post("/api/me/delete", JSON.stringify({ confirm: true }), a.cookie)).status).toBe(204);
    expect(await rowCount(a.accountId)).toBe(0);
    expect(await rowCount()).toBe(1);
    expect((await get("/api/me/progress", a.cookie)).status).toBe(401);
    expect((await send(a.cookie, doc({ "savers/a": { completedAt: T(1) } }))).status).toBe(401);
    expect((await stored(b.cookie)).lessons).toEqual({ "savers/a": { completedAt: T(3) } });
    // The same key later starts with nothing.
    expect((await stored((await signIn(key(21))).cookie)).lessons).toEqual({});
  });

  it("logs the route only, never what was learned", async () => {
    const a = await signIn(key(21));
    await send(a.cookie, doc({ "savers/a-very-particular-lesson": { completedAt: T(1), lab: { passed: ["particular-exercise"] } } }));
    await send(a.cookie, { app: "x" });
    await stored(a.cookie);
    const written = JSON.stringify(logs) + JSON.stringify(await sql`select event, detail from security_events`);
    for (const secret of ["a-very-particular-lesson", "particular-exercise", T(1), a.cookie.split("=")[1]!]) expect(written).not.toContain(secret);
    expect(written).toContain("/api/me/progress");
  });

  it("is served by the application, guarded, and has no path to a relay or any outbound connection", () => {
    const mine = appRoutes.filter((r) => r.path === "/api/me/progress");
    expect(mine.map((r) => `${r.method} ${r.auth} ${r.recoveryAllowed ?? false}`).sort()).toEqual(["GET full false", "POST full false"]);
    const source = readFileSync(new URL("../src/progress.ts", import.meta.url), "utf8");
    for (const forbidden of ["WebSocket", "wss:", "ws:", "fetch(", "node:net", "node:http", "node:https", "node:dgram", "nostr", "relay"]) {
      expect(source.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "")).not.toContain(forbidden); // comments aside
    }
    const deps = Object.keys((JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { dependencies: Record<string, string> }).dependencies);
    expect(deps.sort()).toEqual(["@noble/curves", "postgres", "zod"].sort());
  });
});
