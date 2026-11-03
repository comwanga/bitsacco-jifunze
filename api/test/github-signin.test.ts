import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, migrate } from "../src/db.ts";
import { githubRoutes } from "../src/github-routes.ts";
import { createServer, type ErrorLogLine, type LogLine } from "../src/http.ts";
import { Limiter, slash24 } from "../src/ratelimit.ts";
import { healthRoute } from "../src/routes.ts";
import { createSession, readSession } from "../src/sessions.ts";
import { fakeConfig, ORIGIN, resetTestDb, testDatabaseUrl } from "./helpers.ts";
import { startFakeGithub, type FakeGithub } from "./fake-github.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const sql = connect(testDatabaseUrl());
let fake: FakeGithub;
const logs: unknown[] = [];

beforeAll(async () => {
  fake = await startFakeGithub({ clientId: "fake-client-id", clientSecret: "fake-client-secret" });
});
afterAll(async () => {
  await fake.close();
  await sql.end({ timeout: 5 });
});
beforeEach(async () => {
  logs.length = 0;
  fake.setNextUser({ id: 1001, login: "octo", avatar_url: "https://avatars.example/u/1001" });
  await resetTestDb(sql);
  await migrate(sql, dir);
});

type Api = { base: string; close: () => Promise<void> };
const open: Api[] = [];
afterEach(async () => {
  while (open.length) await open.pop()!.close();
});

async function startApi(limiter?: Limiter): Promise<Api> {
  const server = createServer([healthRoute, ...githubRoutes(limiter)], {
    cfg: fakeConfig({ githubOAuthBase: fake.url, githubApiBase: fake.url }),
    sql,
    readSession,
    log: (l: LogLine) => logs.push(l),
    logError: (l: ErrorLogLine) => logs.push(l),
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

const get = (url: string, cookie?: string) =>
  fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {} });
const cookieOf = (res: Response, name: string): string | undefined =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
const pair = (setCookie: string) => setCookie.split(";")[0]!;

/** start -> fake GitHub authorize -> the callback URL path (with query) the browser would follow. */
async function begin(api: Api, qs = "purpose=signin&lang=sw") {
  const start = await get(`${api.base}/api/auth/github/start?${qs}`);
  const pre = pair(cookieOf(start, "__Host-jf_preauth")!);
  const auth = await get(start.headers.get("location")!);
  const back = new URL(auth.headers.get("location")!);
  return { start, pre, callbackPath: `/api/auth/github/callback${back.search}`, state: back.searchParams.get("state")! };
}

const accountCount = async () => Number((await sql`select count(*)::int as n from accounts`)[0]!.n);

describe("github sign-in", () => {
  it("start returns 302 with S256 challenge and sets __Host-jf_preauth (HttpOnly, Secure, SameSite=Lax, Max-Age=600)", async () => {
    const api = await startApi();
    const res = await get(`${api.base}/api/auth/github/start?purpose=signin&lang=en`);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe(`${fake.url}/login/oauth/authorize`);
    expect(loc.searchParams.get("client_id")).toBe("fake-client-id");
    expect(loc.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/github/callback`);
    expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
    expect(loc.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [row] = await sql<{ pkce_verifier: string; secret_hash: Buffer; lang: string }[]>`
      select pkce_verifier, secret_hash, lang from auth_challenges`;
    expect(row!.pkce_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createHash("sha256").update(row!.pkce_verifier).digest("base64url")).toBe(loc.searchParams.get("code_challenge"));
    expect(row!.secret_hash.equals(createHash("sha256").update(loc.searchParams.get("state")!).digest())).toBe(true);
    expect(row!.lang).toBe("en");
    expect(cookieOf(res, "__Host-jf_preauth")).toMatch(
      /^__Host-jf_preauth=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=600$/,
    );
  });

  it("callback creates an account and a session, and redirects to /sw/account/welcome/ when lang=sw", async () => {
    const api = await startApi();
    const { pre, callbackPath } = await begin(api);
    const res = await get(`${api.base}${callbackPath}`, pre);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/sw/account/welcome/");
    const sess = cookieOf(res, "__Host-jf_session")!;
    expect(sess).toMatch(/^__Host-jf_session=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/$/);
    expect(cookieOf(res, "__Host-jf_preauth")).toBe("__Host-jf_preauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    const [acct] = await sql<{ id: string; preferred_lang: string }[]>`select id, preferred_lang from accounts`;
    expect(acct!.preferred_lang).toBe("sw");
    const [ident] = await sql<{ provider_uid: string; handle: string }[]>`select provider_uid, handle from identities`;
    expect(ident).toMatchObject({ provider_uid: "1001", handle: "octo" });
    const s = await readSession(sql, pair(sess).split("=")[1]);
    expect(s).toMatchObject({ accountId: acct!.id, scope: "full" });
    const events = await sql`select event, detail from security_events`;
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("signin");
  });

  it("a second sign-in with the same GitHub id reuses the account and refreshes a renamed login", async () => {
    const api = await startApi();
    const first = await begin(api, "purpose=signin&lang=en&return=/en/learn/");
    await get(`${api.base}${first.callbackPath}`, first.pre);
    fake.setNextUser({ id: 1001, login: "octo-renamed", avatar_url: "https://avatars.example/new" });
    const second = await begin(api, "purpose=signin&lang=en&return=/en/learn/");
    const res = await get(`${api.base}${second.callbackPath}`, second.pre);
    expect(res.headers.get("location")).toBe("/en/learn/");
    expect(await accountCount()).toBe(1);
    const [ident] = await sql<{ handle: string; avatar_url: string }[]>`select handle, avatar_url from identities`;
    expect(ident).toEqual({ handle: "octo-renamed", avatar_url: "https://avatars.example/new" });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from sessions`;
    expect(n).toBe(2);
  });

  it("a signed-in browser signing in again gets a new session and the old one is revoked", async () => {
    const api = await startApi();
    const [a] = await sql<{ id: string }[]>`insert into accounts default values returning id`;
    const old = await createSession(sql, a!.id, "full");
    const { pre, callbackPath } = await begin(api);
    const res = await get(`${api.base}${callbackPath}`, `${pre}; ${pair(old.cookie)}`);
    expect(res.status).toBe(302);
    expect(await readSession(sql, pair(old.cookie).split("=")[1])).toBeNull();
    expect(pair(cookieOf(res, "__Host-jf_session")!)).not.toBe(pair(old.cookie));
  });

  it("state reused -> state_invalid", async () => {
    const api = await startApi();
    const { pre, callbackPath } = await begin(api);
    expect((await get(`${api.base}${callbackPath}`, pre)).headers.get("location")).toBe("/sw/account/welcome/");
    const again = await get(`${api.base}${callbackPath}`, pre);
    expect(again.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
    expect(await accountCount()).toBe(1);
  });

  it("state with the wrong pre-auth cookie -> state_invalid", async () => {
    const api = await startApi();
    const { callbackPath } = await begin(api);
    const wrong = `__Host-jf_preauth=${"A".repeat(43)}`;
    const res = await get(`${api.base}${callbackPath}`, wrong);
    expect(res.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
    const none = await get(`${api.base}${callbackPath}`);
    expect(none.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
    expect(await accountCount()).toBe(0);
  });

  it("expired state -> state_invalid", async () => {
    const api = await startApi();
    const { pre, callbackPath } = await begin(api, "purpose=signin&lang=en");
    await sql`update auth_challenges set expires_at = now() - interval '1 second'`;
    const res = await get(`${api.base}${callbackPath}`, pre);
    expect(res.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
    expect(await accountCount()).toBe(0);
  });

  it("a reauth challenge presented to the sign-in callback -> state_invalid", async () => {
    const api = await startApi();
    const { pre, callbackPath } = await begin(api);
    const [a] = await sql<{ id: string }[]>`insert into accounts default values returning id`;
    const s = await createSession(sql, a!.id, "full");
    await sql`update auth_challenges set purpose = 'reauth', account_id = ${a!.id}, session_token_hash = ${s.tokenHash}`;
    const res = await get(`${api.base}${callbackPath}`, pre);
    expect(res.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
    expect(await sql`select 1 from identities`).toHaveLength(0);
  });

  it("PKCE verifier mismatch (fake rejects) -> github_failed, no account", async () => {
    const api = await startApi();
    const { pre, callbackPath } = await begin(api, "purpose=signin&lang=en");
    await sql`update auth_challenges set pkce_verifier = ${"x".repeat(43)}`;
    const res = await get(`${api.base}${callbackPath}`, pre);
    expect(res.headers.get("location")).toBe("/en/account/signin/?error=github_failed");
    expect(await accountCount()).toBe(0);
    expect(cookieOf(res, "__Host-jf_session")).toBeUndefined();
  });

  it("error=access_denied -> github_denied, no account, challenge left to expire", async () => {
    const api = await startApi();
    const { pre, state } = await begin(api, "purpose=signin&lang=en");
    const res = await get(`${api.base}/api/auth/github/callback?error=access_denied&state=${state}`, pre);
    expect(res.headers.get("location")).toBe("/en/account/signin/?error=github_denied");
    expect(cookieOf(res, "__Host-jf_preauth")).toContain("Max-Age=0");
    expect(await accountCount()).toBe(0);
    const [c] = await sql<{ used_at: Date | null }[]>`select used_at from auth_challenges`;
    expect(c!.used_at).toBeNull();
  });

  it("missing state and code -> state_invalid without touching the database state", async () => {
    const api = await startApi();
    const res = await get(`${api.base}/api/auth/github/callback`);
    expect(res.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
  });

  it.each([
    ["https://evil.example"],
    ["//evil.example"],
    ["/sw/../x"],
    ["/sw/a\\b"],
    ["/en/learn/"], // valid path but wrong language prefix is still a valid path; checked below
  ])("return=%s", async (ret) => {
    const api = await startApi();
    const { pre, callbackPath } = await begin(api, `purpose=signin&lang=sw&return=${encodeURIComponent(ret)}`);
    fake.setNextUser({ id: 1001, login: "octo", avatar_url: null });
    // make the account exist so the callback redirects to returnTo instead of the welcome page
    await get(`${api.base}${callbackPath}`, pre);
    const again = await begin(api, `purpose=signin&lang=sw&return=${encodeURIComponent(ret)}`);
    const res = await get(`${api.base}${again.callbackPath}`, again.pre);
    expect(res.headers.get("location")).toBe(ret === "/en/learn/" ? "/en/learn/" : "/sw/account/");
  });

  it("return=https://evil.example or //evil or /sw/../x -> falls back to /sw/account/ (stored value)", async () => {
    const api = await startApi();
    for (const ret of ["https://evil.example", "//evil", "/sw/../x"]) {
      await get(`${api.base}/api/auth/github/start?purpose=signin&lang=sw&return=${encodeURIComponent(ret)}`);
    }
    const rows = await sql<{ return_to: string }[]>`select return_to from auth_challenges`;
    expect(rows.map((r) => r.return_to)).toEqual(["/sw/account/", "/sw/account/", "/sw/account/"]);
  });

  it("two starts in one browser: the first callback -> state_invalid, the second -> success", async () => {
    const api = await startApi();
    const one = await begin(api);
    const two = await begin(api);
    // the browser now holds the second pre-auth cookie
    const r1 = await get(`${api.base}${one.callbackPath}`, two.pre);
    expect(r1.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
    const r2 = await get(`${api.base}${two.callbackPath}`, two.pre);
    expect(r2.headers.get("location")).toBe("/sw/account/welcome/");
  });

  it("callback succeeds after the API is restarted between start and callback", async () => {
    const first = await startApi();
    const { pre, callbackPath } = await begin(first);
    await first.close();
    const second = await startApi();
    const res = await get(`${second.base}${callbackPath}`, pre);
    expect(res.headers.get("location")).toBe("/sw/account/welcome/");
    expect(await accountCount()).toBe(1);
  });

  it("no column, log line or response contains the access token", async () => {
    const api = await startApi();
    const { pre, callbackPath } = await begin(api);
    const res = await get(`${api.base}${callbackPath}`, pre);
    const token = fake.lastToken()!;
    expect(token).toMatch(/^gho_fake_/);
    const dump: unknown[] = [];
    for (const t of ["accounts", "identities", "sessions", "auth_challenges", "security_events", "recovery_codes"]) {
      dump.push(await sql.unsafe(`select * from ${t}`));
    }
    const hay = JSON.stringify([dump, logs, [...res.headers], await res.text()]);
    expect(hay).not.toContain(token);
    expect(hay).not.toContain("gho_fake_");
  });

  it("start is rate limited at the 31st request in 10 minutes from one IP", async () => {
    const api = await startApi(new Limiter([{ name: "start", key: (ip) => ip, limit: 30, windowMs: 600_000 }]));
    for (let i = 0; i < 30; i++) {
      const r = await get(`${api.base}/api/auth/github/start?purpose=signin&lang=en`);
      expect(r.headers.get("location")).toContain("/login/oauth/authorize");
    }
    const r = await get(`${api.base}/api/auth/github/start?purpose=signin&lang=en`);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/en/account/signin/?error=rate_limited");
    expect(r.headers.getSetCookie()).toHaveLength(0);
    expect(await sql`select 1 from auth_challenges`).toHaveLength(30);
  });

  it("slash24 truncates IPv4 to /24 and IPv6 to /48", () => {
    expect(slash24("203.0.113.77")).toBe("203.0.113.0/24");
    expect(slash24("::ffff:203.0.113.77")).toBe("203.0.113.0/24");
    expect(slash24("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1::/48");
    expect(slash24("2001:db8::1")).toBe("2001:db8:0::/48");
  });
});
