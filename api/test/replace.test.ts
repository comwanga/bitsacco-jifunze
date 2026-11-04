import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replaceGithubIdentity } from "../src/accounts.ts";
import { connect, migrate } from "../src/db.ts";
import { ApiError } from "../src/errors.ts";
import { githubRoutes } from "../src/github-routes.ts";
import { createServer, type ErrorLogLine, type Route } from "../src/http.ts";
import { Limiter } from "../src/ratelimit.ts";
import { issueCodes, recoveryRoutes } from "../src/recovery.ts";
import { healthRoute, routes as appRoutes } from "../src/routes.ts";
import { createSession, logoutRoute, meRoute, readSession } from "../src/sessions.ts";
import { fakeConfig, ORIGIN, resetTestDb, testDatabaseUrl } from "./helpers.ts";
import { startFakeGithub, type FakeGithub, type FakeUser } from "./fake-github.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const sql = connect(testDatabaseUrl());
let fake: FakeGithub;
const errors: ErrorLogLine[] = [];

const A: FakeUser = { id: 1001, login: "octo", avatar_url: "https://avatars.example/u/1001" };
const B: FakeUser = { id: 2002, login: "hubot", avatar_url: "https://avatars.example/u/2002" };
const C: FakeUser = { id: 3003, login: "mona", avatar_url: null };

beforeAll(async () => {
  fake = await startFakeGithub({ clientId: "fake-client-id", clientSecret: "fake-client-secret" });
});
afterAll(async () => {
  await fake.close();
  await sql.end({ timeout: 5 });
});
beforeEach(async () => {
  errors.length = 0;
  fake.setNextUser(A);
  await resetTestDb(sql);
  await migrate(sql, dir);
});

type Api = { base: string; close: () => Promise<void> };
const open: Api[] = [];
afterEach(async () => {
  while (open.length) await open.pop()!.close();
});

const cfg = () => fakeConfig({ githubOAuthBase: fake.url, githubApiBase: fake.url });

async function serve(table: Route[]): Promise<Api> {
  const server = createServer(table, {
    cfg: cfg(),
    sql,
    readSession,
    log: () => {},
    logError: (l) => errors.push(l),
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const api: Api = {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
  open.push(api);
  return api;
}

const startApi = () =>
  serve([healthRoute, meRoute, logoutRoute, ...githubRoutes(new Limiter([])), ...recoveryRoutes(new Limiter([]))]);

const get = (url: string, cookie?: string) => fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {} });
const post = (url: string, body: unknown, cookie?: string) =>
  fetch(url, {
    method: "POST",
    redirect: "manual",
    headers: {
      origin: ORIGIN,
      "x-jifunze": "1",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const cookieOf = (res: Response, name: string): string | undefined =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
const pair = (setCookie: string) => setCookie.split(";")[0]!;
const valueOf = (cookiePair: string) => cookiePair.split("=")[1]!;
const join2 = (...parts: (string | undefined)[]) => parts.filter(Boolean).join("; ");
const CLEAR_PREAUTH = "__Host-jf_preauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

type Flow = { pre: string; callbackPath: string; state: string; code: string };

/** start (with an optional session cookie) -> fake GitHub authorize (as `user`) -> the callback the browser would follow. */
async function begin(api: Api, qs: string, cookie?: string, user: FakeUser = A): Promise<Flow> {
  fake.setNextUser(user);
  const start = await get(`${api.base}/api/auth/github/start?${qs}`, cookie);
  expect(start.status).toBe(302);
  expect(start.headers.get("location")).toContain("/login/oauth/authorize");
  const pre = pair(cookieOf(start, "__Host-jf_preauth")!);
  const auth = await get(start.headers.get("location")!);
  const back = new URL(auth.headers.get("location")!);
  expect(back.origin).toBe(ORIGIN);
  return {
    pre,
    callbackPath: `${back.pathname}${back.search}`,
    state: back.searchParams.get("state")!,
    code: back.searchParams.get("code")!,
  };
}
const finish = (api: Api, f: Flow, cookie?: string) => get(`${api.base}${f.callbackPath}`, join2(f.pre, cookie));

/** A full sign-in as `user`; returns the session cookie pair and the account. */
async function signin(api: Api, user: FakeUser, cookie?: string): Promise<{ cookie: string; accountId: string; location: string }> {
  const f = await begin(api, "purpose=signin&lang=sw", cookie, user);
  const res = await finish(api, f, cookie);
  expect(res.status).toBe(302);
  const c = pair(cookieOf(res, "__Host-jf_session")!);
  const s = await readSession(sql, valueOf(c));
  return { cookie: c, accountId: s!.accountId, location: res.headers.get("location")! };
}

async function accountWith(user: FakeUser, lang: "sw" | "en" = "sw"): Promise<string> {
  const [a] = await sql<{ id: string }[]>`insert into accounts (preferred_lang) values (${lang}) returning id`;
  await sql`insert into identities (account_id, provider, provider_uid, handle, avatar_url)
    values (${a!.id}, 'github', ${String(user.id)}, ${user.login}, ${user.avatar_url})`;
  return a!.id;
}
async function sessionFor(accountId: string, scope: "full" | "recovery"): Promise<{ cookie: string; tokenHash: Buffer }> {
  const s = await createSession(sql, accountId, scope);
  return { cookie: pair(s.cookie), tokenHash: s.tokenHash };
}

/** Everything a reauth or replace may change, minus last_seen_at (which every authenticated request bumps). */
async function snapshot() {
  return {
    accounts: await sql`select id, preferred_lang, deleted_at from accounts order by id`,
    identities: await sql`
      select account_id, provider, provider_uid, handle, avatar_url, linked_at, last_verified_at, revoked_at
      from identities order by provider_uid`,
    sessions: await sql`
      select encode(token_hash, 'hex') as h, account_id, scope, revoked_at, reauth_at, expires_at
      from sessions order by h`,
    events: await sql`select account_id, event, detail from security_events order by id`,
  };
}
const githubUids = async (accountId: string) =>
  (await sql<{ provider_uid: string }[]>`
    select provider_uid from identities where account_id = ${accountId} and provider = 'github'`).map((r) => r.provider_uid);
const accountCount = async () => Number((await sql`select count(*)::int as n from accounts`)[0]!.n);
const reauthAt = async (tokenHash: Buffer) =>
  (await sql<{ reauth_at: Date }[]>`select reauth_at from sessions where token_hash = ${tokenHash}`)[0]!.reauth_at;
const regen = (api: Api, cookie: string) => post(`${api.base}/api/me/recovery-codes`, undefined, cookie);
const errCode = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;

/** Holds `accounts` row `id` locked FOR UPDATE on its own connection until release() is called. */
async function holdAccountLock(id: string): Promise<{ release: () => Promise<void> }> {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let locked!: () => void;
  const isLocked = new Promise<void>((r) => (locked = r));
  const done = sql.begin(async (tx) => {
    await tx`select id from accounts where id = ${id} for update`;
    locked();
    await gate;
  });
  await isLocked;
  return {
    release: async () => {
      release();
      await done;
    },
  };
}

/** Waits until some backend in this database is blocked waiting on a lock. */
async function untilBlockedOnLock(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const rows = await sql`select 1 from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'`;
    if (rows.length > 0) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("no backend became blocked on a lock");
}

describe("replace GitHub identity", () => {
  it("a recovery session replaces GitHub A with GitHub B; B signs in to the same account; A no longer reaches it", async () => {
    const api = await startApi();
    const first = await signin(api, A);
    expect(first.location).toBe("/sw/account/welcome/");
    const x = first.accountId;
    const [code] = await issueCodes(sql, cfg(), x);
    const redeemed = await post(`${api.base}/api/auth/recovery`, { code });
    expect(redeemed.status).toBe(200);
    const recovery = pair(cookieOf(redeemed, "__Host-jf_session")!);
    expect((await readSession(sql, valueOf(recovery)))!.scope).toBe("recovery");

    const f = await begin(api, "purpose=replace&lang=sw", recovery, B);
    expect(f.callbackPath.startsWith("/api/auth/github/callback/replace?")).toBe(true);
    const res = await finish(api, f, recovery);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/sw/account/?replaced=github");
    expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
    const fresh = pair(cookieOf(res, "__Host-jf_session")!);
    expect(fresh).not.toBe(recovery);
    expect(await readSession(sql, valueOf(fresh))).toMatchObject({ accountId: x, scope: "full" });
    expect(await readSession(sql, valueOf(recovery))).toBeNull();
    expect(await readSession(sql, valueOf(first.cookie))).toBeNull();
    expect(await githubUids(x)).toEqual(["2002"]);
    expect(await sql`select 1 from security_events where account_id = ${x} and event = 'identity_replaced'`).toHaveLength(1);
    // the fresh session is the only live one
    expect(await sql`select 1 from sessions where account_id = ${x} and revoked_at is null`).toHaveLength(1);

    const viaB = await signin(api, B);
    expect(viaB.accountId).toBe(x);
    expect(viaB.location).toBe("/sw/account/");

    const viaA = await signin(api, A);
    expect(viaA.accountId).not.toBe(x);
    expect(viaA.location).toBe("/sw/account/welcome/");
    expect(await accountCount()).toBe(2);
    expect(await githubUids(x)).toEqual(["2002"]);
  });

  it('every route in the final 2a table with auth other than "public" rejects a request without a session with 401, and every route without recoveryAllowed rejects a recovery session with 403', async () => {
    const api = await serve(appRoutes);
    const publicPaths = appRoutes.filter((r) => r.auth === "public").map((r) => `${r.method} ${r.path}`).sort();
    expect(publicPaths).toEqual(
      [
        "GET /api/health",
        "GET /api/auth/github/start",
        "GET /api/auth/github/callback",
        "GET /api/auth/github/callback/reauth",
        "GET /api/auth/github/callback/replace",
        "POST /api/auth/recovery",
      ].sort(),
    );
    const guarded = appRoutes.filter((r) => r.auth !== "public");
    const fullOnly = guarded.filter((r) => !r.recoveryAllowed);
    expect(guarded.length).toBeGreaterThan(0);
    expect(fullOnly.length).toBeGreaterThan(0);

    const [acct] = await sql<{ id: string }[]>`insert into accounts default values returning id`;
    const recovery = (await sessionFor(acct!.id, "recovery")).cookie;
    const call = (r: Route, cookie?: string) => {
      const path = r.path.replace(/:[a-z]+/gi, "x");
      return r.method === "GET" ? get(`${api.base}${path}`, cookie) : post(`${api.base}${path}`, {}, cookie);
    };
    for (const r of guarded) {
      const res = await call(r);
      expect([`${r.method} ${r.path}`, res.status]).toEqual([`${r.method} ${r.path}`, 401]);
      expect(await errCode(res)).toBe("unauthenticated");
    }
    for (const r of fullOnly) {
      const res = await call(r, recovery);
      expect([`${r.method} ${r.path}`, res.status]).toEqual([`${r.method} ${r.path}`, 403]);
      expect(await errCode(res)).toBe("recovery_scope");
    }
  });

  it("replacing with the same GitHub id → unchanged, success", async () => {
    const api = await startApi();
    const x = await accountWith(A);
    const [before] = await sql<{ linked_at: Date }[]>`select linked_at from identities where account_id = ${x}`;
    const rec = await sessionFor(x, "recovery");
    const f = await begin(api, "purpose=replace&lang=en", rec.cookie, { ...A, login: "octo-renamed" });
    const res = await finish(api, f, rec.cookie);
    expect(res.headers.get("location")).toBe("/en/account/?replaced=github");
    const fresh = pair(cookieOf(res, "__Host-jf_session")!);
    expect(await readSession(sql, valueOf(fresh))).toMatchObject({ accountId: x, scope: "full" });
    expect(await readSession(sql, valueOf(rec.cookie))).toBeNull();
    const [after] = await sql<{ provider_uid: string; handle: string; linked_at: Date }[]>`
      select provider_uid, handle, linked_at from identities where account_id = ${x}`;
    expect(after).toEqual({ provider_uid: "1001", handle: "octo-renamed", linked_at: before!.linked_at });
    expect((await replaceGithubIdentity(sql, x, { id: 1001, login: "octo", avatarUrl: "" })).outcome).toBe("unchanged");
  });

  it("replacing with a GitHub id linked to another account → 409 identity_in_use, both accounts unchanged", async () => {
    const api = await startApi();
    const x = await accountWith(A);
    const y = await accountWith(B);
    const rec = await sessionFor(x, "recovery");
    const f = await begin(api, "purpose=replace&lang=sw", rec.cookie, B);
    const before = await snapshot();
    const res = await finish(api, f, rec.cookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/sw/account/?error=identity_in_use");
    expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
    expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
    expect(await snapshot()).toEqual(before);
    expect(await githubUids(x)).toEqual(["1001"]);
    expect(await githubUids(y)).toEqual(["2002"]);
    await expect(replaceGithubIdentity(sql, x, { id: 2002, login: "hubot", avatarUrl: "" })).rejects.toMatchObject({
      status: 409,
      code: "identity_in_use",
    });
  });

  it("two concurrent replacements on one account → exactly one commits; the other → 409 replace_conflict", async () => {
    const api = await startApi();
    const x = await accountWith(A);
    const rec = await sessionFor(x, "recovery");
    const one = await begin(api, "purpose=replace&lang=sw", rec.cookie, B);
    const two = await begin(api, "purpose=replace&lang=sw", rec.cookie, C);
    const before = await snapshot();

    // Another replacement holds the account row: this one must not wait, and must change nothing.
    const lock = await holdAccountLock(x);
    let res: Response;
    try {
      res = await finish(api, one, rec.cookie);
    } finally {
      await lock.release();
    }
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/sw/account/?error=replace_conflict");
    expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
    expect(await snapshot()).toEqual(before);

    const ok = await finish(api, two, rec.cookie);
    expect(ok.headers.get("location")).toBe("/sw/account/?replaced=github");
    expect(await githubUids(x)).toEqual(["3003"]);
    expect(await sql`select 1 from security_events where event = 'identity_replaced'`).toHaveLength(1);

    // The same at the function level.
    const held = await holdAccountLock(x);
    try {
      await expect(replaceGithubIdentity(sql, x, { id: 4004, login: "z", avatarUrl: "" })).rejects.toMatchObject({
        status: 409,
        code: "replace_conflict",
      });
    } finally {
      await held.release();
    }
    expect(await githubUids(x)).toEqual(["3003"]);
  });

  /** Runs `work` in a transaction on its own connection and keeps it open until commit() is called. */
  async function openTx(work: (tx: typeof sql) => Promise<unknown>): Promise<{ commit: () => Promise<void> }> {
    let commit!: () => void;
    const gate = new Promise<void>((r) => (commit = r));
    let ready!: () => void;
    const isReady = new Promise<void>((r) => (ready = r));
    const done = sql.begin(async (tx) => {
      await work(tx);
      ready();
      await gate;
    });
    await isReady;
    return {
      commit: async () => {
        commit();
        await done;
      },
    };
  }

  it("an uncommitted insert referencing the account (FK key-share lock) does not make a replacement conflict", async () => {
    const x = await accountWith(A);
    const other = await openTx((tx) => tx`insert into security_events (account_id, event) values (${x}, 'unrelated')`);
    try {
      const r = await replaceGithubIdentity(sql, x, { id: 2002, login: "hubot", avatarUrl: "" });
      expect(r.outcome).toBe("replaced");
    } finally {
      await other.commit();
    }
    expect(await githubUids(x)).toEqual(["2002"]);
  });

  it("a revocation of the initiating session racing the replacement serialises on the session row: the replacement sees it and refuses", async () => {
    const x = await accountWith(A);
    const rec = await sessionFor(x, "recovery");
    const revoke = await openTx((tx) => tx`update sessions set revoked_at = now() where token_hash = ${rec.tokenHash}`);
    const pending = replaceGithubIdentity(sql, x, { id: 2002, login: "hubot", avatarUrl: "" }, {
      tokenHash: rec.tokenHash,
      scope: "recovery",
    }).catch((e: unknown) => e);
    await untilBlockedOnLock(); // waiting on the session row the revocation holds
    await revoke.commit();
    expect(await pending).toMatchObject({ status: 401, code: "unauthenticated" });
    expect(await githubUids(x)).toEqual(["1001"]);
    expect(await sql`select 1 from sessions where account_id = ${x}`).toHaveLength(1);
    expect(await sql`select 1 from security_events where event = 'identity_replaced'`).toHaveLength(0);
  });

  it("two accounts racing to take the same new GitHub id → one wins; the loser → 409 identity_in_use, unchanged", async () => {
    const api = await startApi();
    const x = await accountWith(A);
    const y = await accountWith(B);
    const rec = await sessionFor(x, "recovery");
    const f = await begin(api, "purpose=replace&lang=sw", rec.cookie, C);
    const before = await snapshot();

    // Y's replacement is past its checks and has written C, but has not committed yet.
    let commit!: () => void;
    const gate = new Promise<void>((r) => (commit = r));
    let written!: () => void;
    const isWritten = new Promise<void>((r) => (written = r));
    const yTx = sql.begin(async (tx) => {
      await tx`select id from accounts where id = ${y} for update`;
      await tx`delete from identities where account_id = ${y} and provider = 'github'`;
      await tx`insert into identities (account_id, provider, provider_uid, handle) values (${y}, 'github', '3003', 'mona')`;
      written();
      await gate;
    });
    await isWritten;
    const xRes = finish(api, f, rec.cookie);
    await untilBlockedOnLock(); // X passed its own checks and now waits on the unique index
    commit();
    await yTx;
    const res = await xRes;
    expect(res.headers.get("location")).toBe("/sw/account/?error=identity_in_use");
    expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
    expect(await githubUids(x)).toEqual(["1001"]);
    expect(await githubUids(y)).toEqual(["3003"]);
    const after = await snapshot();
    expect(after.sessions).toEqual(before.sessions);
    expect(after.events).toEqual(before.events);
    expect(after.identities.filter((i) => i.account_id === x)).toEqual(before.identities.filter((i) => i.account_id === x));
  });

  it("a replace callback after the recovery session expired → 401 unauthenticated, nothing changed", async () => {
    const api = await startApi();
    const x = await accountWith(A);
    const rec = await sessionFor(x, "recovery");
    const f = await begin(api, "purpose=replace&lang=sw", rec.cookie, B);
    await sql`update sessions set expires_at = now() - interval '1 second' where token_hash = ${rec.tokenHash}`;
    const before = await snapshot();
    const res = await finish(api, f, rec.cookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/sw/account/signin/?error=unauthenticated");
    expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
    expect(await snapshot()).toEqual(before);
  });

  it("a replace challenge used for signin → state_invalid, and the reverse", async () => {
    const api = await startApi();
    const x = await accountWith(A);
    const rec = await sessionFor(x, "recovery");
    const f = await begin(api, "purpose=replace&lang=sw", rec.cookie, B);
    const before = await snapshot();
    const asSignin = await get(`${api.base}/api/auth/github/callback?code=${f.code}&state=${f.state}`, join2(f.pre, rec.cookie));
    expect(asSignin.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
    expect(await snapshot()).toEqual(before);

    const s = await begin(api, "purpose=signin&lang=sw", undefined, B);
    for (const purpose of ["replace", "reauth"]) {
      const r = await get(`${api.base}/api/auth/github/callback/${purpose}?code=${s.code}&state=${s.state}`, join2(s.pre, rec.cookie));
      expect(r.headers.get("location")).toBe("/sw/account/?error=state_invalid");
    }
    const r = await begin(api, "purpose=reauth&lang=sw", (await sessionFor(x, "full")).cookie);
    const asReplace = await get(`${api.base}/api/auth/github/callback/replace?code=${r.code}&state=${r.state}`, join2(r.pre, rec.cookie));
    expect(asReplace.headers.get("location")).toBe("/sw/account/?error=state_invalid");
    const after = await snapshot();
    expect(after.identities).toEqual(before.identities);
    expect(after.events).toEqual(before.events);
    expect(await accountCount()).toBe(1);
  });

  it("a full session without recent re-auth cannot start replace → 403 reauth_required", async () => {
    const api = await startApi();
    const x = await accountWith(A);
    const full = await sessionFor(x, "full");
    await sql`update sessions set reauth_at = now() - interval '11 minutes' where token_hash = ${full.tokenHash}`;
    const res = await get(`${api.base}/api/auth/github/start?purpose=replace&lang=en`, full.cookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/en/account/?error=reauth_required");
    expect(res.headers.getSetCookie()).toHaveLength(0);
    expect(await sql`select 1 from auth_challenges`).toHaveLength(0);

    // No session at all, or a recovery session asking to reauth: no suitable session.
    for (const [qs, cookie] of [
      ["purpose=replace&lang=en", undefined],
      ["purpose=reauth&lang=en", undefined],
      ["purpose=reauth&lang=en", (await sessionFor(x, "recovery")).cookie],
    ] as const) {
      const r = await get(`${api.base}/api/auth/github/start?${qs}`, cookie);
      expect(r.headers.get("location")).toBe("/en/account/signin/?error=unauthenticated");
    }
    expect(await sql`select 1 from auth_challenges`).toHaveLength(0);

    // A fresh re-auth window allows it, and the challenge is bound to that session.
    await sql`update sessions set reauth_at = now() - interval '9 minutes' where token_hash = ${full.tokenHash}`;
    const f = await begin(api, "purpose=replace&lang=en", full.cookie, B);
    const [ch] = await sql<{ purpose: string; account_id: string; session_token_hash: Buffer }[]>`
      select purpose, account_id, session_token_hash from auth_challenges`;
    expect(ch!.purpose).toBe("replace");
    expect(ch!.account_id).toBe(x);
    expect(ch!.session_token_hash.equals(full.tokenHash)).toBe(true);
    const ok = await finish(api, f, full.cookie);
    expect(ok.headers.get("location")).toBe("/en/account/?replaced=github");
    expect(await readSession(sql, valueOf(full.cookie))).toBeNull();
    expect(await githubUids(x)).toEqual(["2002"]);
  });

  it("reauth sets reauth_at, and regenerating codes then succeeds within 10 minutes and fails after", async () => {
    const api = await startApi();
    const first = await signin(api, A);
    const tokenHash = (await readSession(sql, valueOf(first.cookie)))!.tokenHash;
    await sql`update sessions set reauth_at = now() - interval '1 hour' where token_hash = ${tokenHash}`;
    const denied = await regen(api, first.cookie);
    expect(denied.status).toBe(403);
    expect(await errCode(denied)).toBe("reauth_required");

    const f = await begin(api, "purpose=reauth&lang=sw&return=/sw/account/recovery-codes/", first.cookie, A);
    expect(f.callbackPath.startsWith("/api/auth/github/callback/reauth?")).toBe(true);
    const sessionsBefore = await sql`select 1 from sessions`;
    const res = await finish(api, f, first.cookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/sw/account/recovery-codes/");
    expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
    expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
    expect(await sql`select 1 from sessions`).toHaveLength(sessionsBefore.length);
    expect(Date.now() - (await reauthAt(tokenHash)).getTime()).toBeLessThan(60_000);

    expect((await regen(api, first.cookie)).status).toBe(200);
    await sql`update sessions set reauth_at = now() - interval '11 minutes' where token_hash = ${tokenHash}`;
    const late = await regen(api, first.cookie);
    expect(late.status).toBe(403);
    expect(await errCode(late)).toBe("reauth_required");

    // The default return is the account page.
    const g = await begin(api, "purpose=reauth&lang=en", first.cookie, A);
    expect((await finish(api, g, first.cookie)).headers.get("location")).toBe("/en/account/");
  });

  describe("correction A: re-auth must be completed by the linked GitHub account", () => {
    it("reauth completed with a different GitHub account than the one linked → reauth_mismatch; reauth_at unchanged; no identity, account or session change; the other GitHub account is not linked or created", async () => {
      const api = await startApi();
      const x = await accountWith(A);
      const full = await sessionFor(x, "full");
      await sql`update sessions set reauth_at = now() - interval '1 hour' where token_hash = ${full.tokenHash}`;
      const f = await begin(api, "purpose=reauth&lang=sw", full.cookie, B);
      const before = await snapshot();
      const res = await finish(api, f, full.cookie);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/sw/account/?error=reauth_mismatch");
      expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
      expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
      expect(await snapshot()).toEqual(before);
      expect(await sql`select 1 from identities where provider_uid = '2002'`).toHaveLength(0);
      expect(await accountCount()).toBe(1);
      expect(await readSession(sql, valueOf(full.cookie))).toMatchObject({ accountId: x, scope: "full" });
    });

    it("reauth with the linked account succeeds even after its login was renamed", async () => {
      const api = await startApi();
      const x = await accountWith(A);
      const full = await sessionFor(x, "full");
      await sql`update sessions set reauth_at = now() - interval '1 hour' where token_hash = ${full.tokenHash}`;
      const f = await begin(api, "purpose=reauth&lang=sw", full.cookie, { ...A, login: "octo-2026" });
      const res = await finish(api, f, full.cookie);
      expect(res.headers.get("location")).toBe("/sw/account/");
      expect(Date.now() - (await reauthAt(full.tokenHash)).getTime()).toBeLessThan(60_000);
      expect(await githubUids(x)).toEqual(["1001"]);
      expect(await accountCount()).toBe(1);
    });

    it("a reauth_mismatch cannot then be used to regenerate codes", async () => {
      const api = await startApi();
      const x = await accountWith(A);
      const full = await sessionFor(x, "full");
      await sql`update sessions set reauth_at = now() - interval '1 hour' where token_hash = ${full.tokenHash}`;
      const f = await begin(api, "purpose=reauth&lang=sw", full.cookie, B);
      expect((await finish(api, f, full.cookie)).headers.get("location")).toBe("/sw/account/?error=reauth_mismatch");
      const r = await regen(api, full.cookie);
      expect(r.status).toBe(403);
      expect(await errCode(r)).toBe("reauth_required");
      expect(await sql`select 1 from recovery_codes`).toHaveLength(0);
    });
  });

  describe("correction B: reauth/replace challenges are bound to the initiating session", () => {
    // For reauth the initiator is a full session and the callback GitHub user is the linked one (so only the
    // binding can fail); for replace it is a recovery session and the callback user is a new one.
    const kinds = [
      { purpose: "reauth", scope: "full", user: A },
      { purpose: "replace", scope: "recovery", user: B },
    ] as const;

    async function setup(kind: (typeof kinds)[number]) {
      const api = await startApi();
      const x = await accountWith(A);
      const init = await sessionFor(x, kind.scope);
      await sql`update sessions set reauth_at = now() - interval '1 hour' where token_hash = ${init.tokenHash}`;
      const f = await begin(api, `purpose=${kind.purpose}&lang=sw`, init.cookie, kind.user);
      return { api, x, init, f };
    }
    const UNAUTH = "/sw/account/signin/?error=unauthenticated";

    it.each(kinds)("a $purpose callback presenting a different session of the same account → unauthenticated, nothing changed", async (kind) => {
      const { api, x, f } = await setup(kind);
      const other = await sessionFor(x, kind.scope);
      const before = await snapshot();
      const res = await finish(api, f, other.cookie);
      expect(res.headers.get("location")).toBe(UNAUTH);
      expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
      expect(await snapshot()).toEqual(before);
    });

    it.each(kinds)("a $purpose callback presenting no session cookie → unauthenticated", async (kind) => {
      const { api, f } = await setup(kind);
      const before = await snapshot();
      const res = await finish(api, f);
      expect(res.headers.get("location")).toBe(UNAUTH);
      expect(await snapshot()).toEqual(before);
    });

    it.each(kinds)("a $purpose callback after the initiating session was revoked (logout) → unauthenticated", async (kind) => {
      const { api, init, f } = await setup(kind);
      expect((await post(`${api.base}/api/auth/logout`, undefined, init.cookie)).status).toBe(204);
      const before = await snapshot();
      const res = await finish(api, f, init.cookie);
      expect(res.headers.get("location")).toBe(UNAUTH);
      expect(await snapshot()).toEqual(before);
    });

    it.each(kinds)("a $purpose callback after the initiating session was revoked by a recovery elsewhere → unauthenticated", async (kind) => {
      const { api, x, init, f } = await setup(kind);
      const [code] = await issueCodes(sql, cfg(), x);
      const redeemed = await post(`${api.base}/api/auth/recovery`, { code });
      expect(redeemed.status).toBe(200);
      const elsewhere = pair(cookieOf(redeemed, "__Host-jf_session")!);
      const before = await snapshot();
      expect((await finish(api, f, init.cookie)).headers.get("location")).toBe(UNAUTH);
      expect(await snapshot()).toEqual(before);
      // the revoked session cannot even start a new flow
      const again = await get(`${api.base}/api/auth/github/start?purpose=${kind.purpose}&lang=sw`, init.cookie);
      expect(again.status).toBe(302);
      expect(again.headers.get("location")).toBe(UNAUTH);
      expect(again.headers.getSetCookie()).toHaveLength(0);
      expect(await readSession(sql, valueOf(elsewhere))).not.toBeNull();
    });

    it.each(kinds)("a $purpose callback after the initiating session expired → unauthenticated", async (kind) => {
      const { api, init, f } = await setup(kind);
      await sql`update sessions set expires_at = now() - interval '1 second' where token_hash = ${init.tokenHash}`;
      const before = await snapshot();
      expect((await finish(api, f, init.cookie)).headers.get("location")).toBe(UNAUTH);
      expect(await snapshot()).toEqual(before);
    });

    it.each(kinds)("a $purpose callback with a session of another account → unauthenticated", async (kind) => {
      const { api, f } = await setup(kind);
      const y = await accountWith(C);
      const theirs = await sessionFor(y, kind.scope);
      const before = await snapshot();
      expect((await finish(api, f, theirs.cookie)).headers.get("location")).toBe(UNAUTH);
      expect(await snapshot()).toEqual(before);
    });

    it("a replace started from a recovery session whose scope changed (the recovery session ended and the user signed in normally) → unauthenticated", async () => {
      const { api, x, init, f } = await setup(kinds[1]);
      const normal = await signin(api, A, init.cookie); // signing in revokes the recovery session
      expect(normal.accountId).toBe(x);
      expect(await readSession(sql, valueOf(init.cookie))).toBeNull();
      const before = await snapshot();
      const res = await finish(api, f, normal.cookie);
      expect(res.headers.get("location")).toBe(UNAUTH);
      expect(await snapshot()).toEqual(before);
      expect(await githubUids(x)).toEqual(["1001"]);
    });

    it("replaying a completed reauth callback (same state and code) → state_invalid", async () => {
      const re = await setup(kinds[0]);
      expect((await finish(re.api, re.f, re.init.cookie)).headers.get("location")).toBe("/sw/account/");
      const before = await snapshot();
      expect((await finish(re.api, re.f, re.init.cookie)).headers.get("location")).toBe("/sw/account/?error=state_invalid");
      expect(await snapshot()).toEqual(before);
    });

    it("replaying a completed replace callback (same state and code) → state_invalid", async () => {
      const rp = await setup(kinds[1]);
      const done = await finish(rp.api, rp.f, rp.init.cookie);
      expect(done.headers.get("location")).toBe("/sw/account/?replaced=github");
      const fresh = pair(cookieOf(done, "__Host-jf_session")!);
      const after = await snapshot();
      const replay = await finish(rp.api, rp.f, fresh);
      expect(replay.headers.get("location")).toBe("/sw/account/?error=state_invalid");
      expect(cookieOf(replay, "__Host-jf_session")).toBeUndefined();
      expect(await snapshot()).toEqual(after);
    });

    it("the binding check happens before the transaction, and the transaction still holds the account row lock, so the concurrency tests above keep passing", async () => {
      const { api, x, f } = await setup(kinds[1]);
      const other = await sessionFor(x, "recovery");
      const before = await snapshot();
      // With the row locked, a wrong session is refused for its binding (unauthenticated), not as a lock conflict.
      const lock = await holdAccountLock(x);
      let res: Response;
      try {
        res = await finish(api, f, other.cookie);
      } finally {
        await lock.release();
      }
      expect(res.headers.get("location")).toBe(UNAUTH);
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("callback failures always end in a redirect", () => {
    it("a database error during replace → 302 to the account page with error=internal, pre-auth cleared, logged without secrets, nothing changed", async () => {
      const api = await startApi();
      const x = await accountWith(A);
      const rec = await sessionFor(x, "recovery");
      const f = await begin(api, "purpose=replace&lang=sw", rec.cookie, B);
      await sql.unsafe(`
        create function fail_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$;
        create trigger identities_fail before insert on identities for each row execute function fail_insert();`);
      const before = await snapshot();
      const res = await finish(api, f, rec.cookie);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/sw/account/?error=internal");
      expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
      expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
      expect(await snapshot()).toEqual(before);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ method: "GET", route: "/api/auth/github/callback/replace" });
      expect(Object.keys(errors[0]!).sort()).toEqual(["method", "name", "route", "stack"]);
      const out = JSON.stringify(errors);
      for (const secret of [f.state, f.code, valueOf(f.pre), valueOf(rec.cookie)]) expect(out).not.toContain(secret);
    });

    it.each(["B", "A"] as const)(
      "a failure creating the fresh session during replace (new user %s) rolls back the identity change and the revocations",
      async (who) => {
        const api = await startApi();
        const x = await accountWith(A);
        const rec = await sessionFor(x, "recovery");
        const bystander = await sessionFor(x, "full");
        const f = await begin(api, "purpose=replace&lang=sw", rec.cookie, who === "B" ? B : { ...A, login: "octo-new" });
        await sql.unsafe(`
          create function fail_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$;
          create trigger sessions_fail before insert on sessions for each row execute function fail_insert();`);
        const before = await snapshot();
        const res = await finish(api, f, rec.cookie);
        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("/sw/account/?error=internal");
        expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
        expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
        expect(await snapshot()).toEqual(before); // identity, sessions and events all unchanged
        expect(await githubUids(x)).toEqual(["1001"]);
        expect(await readSession(sql, valueOf(rec.cookie))).not.toBeNull();
        expect(await readSession(sql, valueOf(bystander.cookie))).not.toBeNull();
        expect(errors).toHaveLength(1);
      },
    );

    it("a session-creation failure during sign-in → 302 with error=internal and no orphan account or identity", async () => {
      const api = await startApi();
      const f = await begin(api, "purpose=signin&lang=en", undefined, A);
      await sql.unsafe(`
        create function fail_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$;
        create trigger sessions_fail before insert on sessions for each row execute function fail_insert();`);
      const res = await finish(api, f);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/en/account/signin/?error=internal");
      expect(cookieOf(res, "__Host-jf_preauth")).toBe(CLEAR_PREAUTH);
      expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
      expect(await accountCount()).toBe(0);
      expect(await sql`select 1 from identities`).toHaveLength(0);
      expect(await sql`select 1 from security_events`).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ method: "GET", route: "/api/auth/github/callback" });
      const out = JSON.stringify(errors);
      for (const secret of [f.state, f.code, valueOf(f.pre)]) expect(out).not.toContain(secret);
    });

    it("replaceGithubIdentity surfaces conflicts as ApiError", async () => {
      const x = await accountWith(A);
      const err = await replaceGithubIdentity(sql, x, { id: 1001, login: "octo", avatarUrl: "" }).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeNull();
      await accountWith(B);
      const e2 = await replaceGithubIdentity(sql, x, { id: 2002, login: "hubot", avatarUrl: "" }).catch((e: unknown) => e);
      expect(e2).toBeInstanceOf(ApiError);
    });
  });
});
