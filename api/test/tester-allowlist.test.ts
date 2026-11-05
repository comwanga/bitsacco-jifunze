import { readdirSync, readFileSync } from "node:fs";
import { get as httpGet } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { schnorr } from "@noble/curves/secp256k1.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, type Config } from "../src/config.ts";
import { connect, migrate } from "../src/db.ts";
import { githubRoutes } from "../src/github-routes.ts";
import { createServer, PREAUTH_COOKIE, SESSION_COOKIE, type Route } from "../src/http.ts";
import { nostrRoutes } from "../src/nostr-routes.ts";
import { Limiter, perIp } from "../src/ratelimit.ts";
import { generateCodes, recoveryRoutes } from "../src/recovery.ts";
import { healthRoute, routes } from "../src/routes.ts";
import { createSession, logoutRoute, meRoute, readSession } from "../src/sessions.ts";
import { startFakeGithub, type FakeGithub } from "./fake-github.ts";
import { fakeConfig, ORIGIN, resetTestDb, testDatabaseUrl } from "./helpers.ts";
import { header, signedEvent, testKey } from "./nostr-helper.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const sql = connect(testDatabaseUrl());

// Synthetic identities only.
const TESTER_ID = 1001;
const OUTSIDER_ID = 2002;
const SECOND_TESTER_ID = 3003;
const outsiderKey = new Uint8Array(32).fill(9);
const hex = (key: Uint8Array) => Buffer.from(schnorr.getPublicKey(key)).toString("hex");
const TESTER_PUBKEY = hex(testKey);
const OUTSIDER_PUBKEY = hex(outsiderKey);
const CANONICAL_HOST = new URL(ORIGIN).host;
const GENERATED_ORIGIN = "https://web-staging-d337.up.railway.app";

const allowlist = (github: number[] = [TESTER_ID], nostr: string[] = [TESTER_PUBKEY]) => ({
  github: new Set(github.map(String)),
  nostr: new Set(nostr),
});

let fake: FakeGithub;
beforeAll(async () => {
  fake = await startFakeGithub({ clientId: "fake-client-id", clientSecret: "fake-client-secret" });
});
afterAll(async () => {
  await fake.close();
  await sql.end({ timeout: 5 });
});
beforeEach(async () => {
  await resetTestDb(sql);
  await migrate(sql, dir);
});

type Api = { base: string; port: number; close: () => Promise<void> };
const open: Api[] = [];
afterEach(async () => {
  while (open.length) await open.pop()!.close();
});

const unlimited = () => new Limiter([]);
const oneHit = () => new Limiter([{ name: "test", key: perIp, limit: 1, windowMs: 60_000 }]);

function fullRoutes(limits: { githubStart?: Limiter; nostrVerify?: Limiter; recovery?: Limiter } = {}): Route[] {
  return [
    healthRoute, meRoute, logoutRoute,
    ...githubRoutes(limits.githubStart ?? unlimited()),
    ...nostrRoutes(unlimited(), limits.nostrVerify ?? unlimited()),
    ...recoveryRoutes(limits.recovery ?? unlimited()),
  ];
}

function configWith(over: Partial<Config>): Config {
  return fakeConfig({ githubOAuthBase: fake.url, githubApiBase: fake.url, ...over });
}

async function startApi(list: Config["testerAllowlist"], table: Route[] = fullRoutes(), cfg?: Config): Promise<Api> {
  const server = createServer(table, {
    cfg: cfg ?? configWith({ testerAllowlist: list }),
    sql,
    readSession,
    log: () => {},
    logError: () => {},
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  const api: Api = {
    base: `http://127.0.0.1:${port}`,
    port,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
  open.push(api);
  return api;
}

const pairOf = (res: Response, name: string): string =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(";")[0] ?? "";
const sessionPair = (res: Response) => pairOf(res, SESSION_COOKIE);
const count = async (table: "accounts" | "identities" | "sessions" | "recovery_codes") =>
  Number((await sql.unsafe(`select count(*)::int as n from ${table}`))[0]!.n);
const get = (url: string, cookie?: string) => fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {} });

/** The whole GitHub round trip, as a browser would make it. */
async function githubFlow(api: Api, userId: number, purpose: "signin" | "reauth" | "replace" = "signin", session = "") {
  fake.setNextUser({ id: userId, login: `user${userId}`, avatar_url: null });
  const start = await get(`${api.base}/api/auth/github/start?purpose=${purpose}&lang=sw`, session);
  expect(start.status).toBe(302);
  const pre = pairOf(start, PREAUTH_COOKIE);
  const auth = await get(start.headers.get("location")!);
  const back = new URL(auth.headers.get("location")!);
  const url = `${api.base}${back.pathname}${back.search}`;
  const cookie = [pre, session].filter(Boolean).join("; ");
  return { response: await get(url, cookie), url, cookie };
}

const post = (api: Api, path: string, body: string, cookie = "", authorization?: string, origin = ORIGIN) =>
  fetch(api.base + path, {
    method: "POST",
    headers: { origin, "X-Jifunze": "1", "Content-Type": "application/json", cookie, ...(authorization ? { authorization } : {}) },
    body,
  });

async function nostrChallenge(api: Api) {
  const res = await post(api, "/api/auth/nostr/challenge", JSON.stringify({ lang: "sw", returnTo: "/sw/account/" }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { challengeId: string; nonce: string; url: string };
  return { body, raw: JSON.stringify({ challengeId: body.challengeId, nonce: body.nonce }), pre: pairOf(res, PREAUTH_COOKIE) };
}
type Challenge = Awaited<ReturnType<typeof nostrChallenge>>;

const nostrLogin = (api: Api, c: Challenge, key = testKey) =>
  post(api, "/api/auth/nostr/verify", c.raw, c.pre, header(signedEvent(Buffer.from(c.raw), c.body.url, undefined, {}, [], key)));

const usedAt = async (id: string) =>
  (await sql<{ used_at: Date | null }[]>`select used_at from auth_challenges where id = ${id}`)[0]!.used_at;

async function githubAccount(uid: number): Promise<string> {
  const [acct] = await sql<{ id: string }[]>`insert into accounts default values returning id`;
  await sql`insert into identities (account_id, provider, provider_uid) values (${acct!.id}, 'github', ${String(uid)})`;
  return acct!.id;
}

async function issueWith(api: Api, session: string): Promise<string> {
  const res = await fetch(`${api.base}/api/me/recovery-codes/initial`, {
    method: "POST",
    headers: { origin: ORIGIN, "X-Jifunze": "1", cookie: session },
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { codes: string[] }).codes[0]!;
}

describe("allowlist configuration", () => {
  const base = {
    SITE_ORIGIN: "https://staging.example",
    DATABASE_URL: "postgres://x",
    GITHUB_CLIENT_ID: "id",
    GITHUB_CLIENT_SECRET: "secret",
    RECOVERY_PEPPER_V1: Buffer.alloc(32, 1).toString("base64"),
  };
  const denyAll = { github: new Set(), nostr: new Set() };

  it("is off for local development with nothing configured", () => {
    expect(loadConfig(base).testerAllowlist).toBeNull();
  });

  it("is off only for a Railway production environment on the production origin", () => {
    const cfg = loadConfig({ ...base, SITE_ORIGIN: "https://bitsaccojifunze.xyz", RAILWAY_ENVIRONMENT_NAME: "production" });
    expect(cfg.testerAllowlist).toBeNull();
  });

  it.each([
    ["staging on its own origin", { RAILWAY_ENVIRONMENT_NAME: "staging" }],
    ["staging pointed at the production origin", { RAILWAY_ENVIRONMENT_NAME: "staging", SITE_ORIGIN: "https://bitsaccojifunze.xyz" }],
    ["a renamed or preview environment", { RAILWAY_ENVIRONMENT_NAME: "pr-42" }],
    ["production on another origin", { RAILWAY_ENVIRONMENT_NAME: "production" }],
  ])("denies everyone when missing on %s", (_name, env) => {
    const cfg = loadConfig({ ...base, ...env });
    expect(cfg.testerAllowlist).toEqual(denyAll);
    expect(cfg.testerAllowlistInvalid).toEqual([]);
  });

  it("applies whenever either variable is present, even outside Railway", () => {
    expect(loadConfig({ ...base, TESTER_GITHUB_IDS: "1001" }).testerAllowlist).toEqual({ github: new Set(["1001"]), nostr: new Set() });
    expect(loadConfig({ ...base, TESTER_NOSTR_PUBKEYS: "" }).testerAllowlist).toEqual(denyAll);
  });

  it("parses comma-separated numeric ids and lowercase hex pubkeys, ignoring surrounding spaces", () => {
    const cfg = loadConfig({ ...base, TESTER_GITHUB_IDS: " 1001, 3003 ", TESTER_NOSTR_PUBKEYS: `${TESTER_PUBKEY} , ${OUTSIDER_PUBKEY}` });
    expect(cfg.testerAllowlist).toEqual({ github: new Set(["1001", "3003"]), nostr: new Set([TESTER_PUBKEY, OUTSIDER_PUBKEY]) });
    expect(cfg.testerAllowlistInvalid).toEqual([]);
  });

  it.each(["octocat", "0", "-1", "1.5", "01", "1e3", "1,,2", "1,", ",1", "1 2", "9007199254740993", "١٢"])(
    "one malformed GitHub entry (%s) denies everyone and names only the key",
    (value) => {
      const cfg = loadConfig({ ...base, TESTER_GITHUB_IDS: value, TESTER_NOSTR_PUBKEYS: TESTER_PUBKEY });
      expect(cfg.testerAllowlist).toEqual(denyAll);
      expect(cfg.testerAllowlistInvalid).toEqual(["TESTER_GITHUB_IDS"]);
    },
  );

  it.each([
    TESTER_PUBKEY.toUpperCase(),
    TESTER_PUBKEY.slice(0, 63),
    `${TESTER_PUBKEY}0`,
    "npub1zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    `${TESTER_PUBKEY},`,
  ])("one malformed Nostr entry (%s) denies everyone and names only the key", (value) => {
    const cfg = loadConfig({ ...base, TESTER_GITHUB_IDS: "1001", TESTER_NOSTR_PUBKEYS: value });
    expect(cfg.testerAllowlist).toEqual(denyAll);
    expect(cfg.testerAllowlistInvalid).toEqual(["TESTER_NOSTR_PUBKEYS"]);
  });
});

describe("GitHub sign-in", () => {
  it("an allowlisted identity gets one account and a full session, and returns to the same account", async () => {
    const api = await startApi(allowlist());
    const first = await githubFlow(api, TESTER_ID);
    expect(first.response.headers.get("location")).toBe("/sw/account/welcome/");
    const firstSession = await readSession(sql, sessionPair(first.response).split("=")[1]);
    expect(firstSession?.scope).toBe("full");

    const again = await githubFlow(api, TESTER_ID);
    expect(again.response.headers.get("location")).toBe("/sw/account/");
    expect((await readSession(sql, sessionPair(again.response).split("=")[1]))?.accountId).toBe(firstSession!.accountId);
    expect(await count("accounts")).toBe(1);
  });

  it("an unlisted identity creates no account, identity or session", async () => {
    const api = await startApi(allowlist());
    const { response } = await githubFlow(api, OUTSIDER_ID);
    expect(response.status).toBe(302);
    expect(sessionPair(response)).toBe("");
    expect(await count("accounts")).toBe(0);
    expect(await count("identities")).toBe(0);
    expect(await count("sessions")).toBe(0);
  });

  it("the refusal is identical to a stale sign-in request", async () => {
    const api = await startApi(allowlist());
    const denied = await githubFlow(api, OUTSIDER_ID);
    const stale = await get(denied.url, denied.cookie); // the same callback replayed: the challenge is spent
    expect(denied.response.status).toBe(stale.status);
    expect(denied.response.headers.get("location")).toBe(stale.headers.get("location"));
    expect(denied.response.headers.get("location")).toBe("/sw/account/signin/?error=state_invalid");
    expect(denied.response.headers.getSetCookie()).toEqual(stale.headers.getSetCookie());
  });

  it("refusing an unlisted identity leaves the browser's existing session alone", async () => {
    const api = await startApi(allowlist());
    const session = sessionPair((await githubFlow(api, TESTER_ID)).response);
    const { response } = await githubFlow(api, OUTSIDER_ID, "signin", session);
    expect(sessionPair(response)).toBe("");
    expect(await readSession(sql, session.split("=")[1])).not.toBeNull();
    expect(await count("accounts")).toBe(1);
  });

  it("reauthentication still works for the linked, allowlisted identity", async () => {
    const api = await startApi(allowlist());
    const session = sessionPair((await githubFlow(api, TESTER_ID)).response);
    const { response } = await githubFlow(api, TESTER_ID, "reauth", session);
    expect(response.headers.get("location")).toBe("/sw/account/");
    const events = await sql`select 1 from security_events where event = 'reauth'`;
    expect(events.length).toBe(1);
  });
});

describe("GitHub identity replacement", () => {
  it("cannot move an account onto an unlisted identity", async () => {
    const api = await startApi(allowlist());
    const session = sessionPair((await githubFlow(api, TESTER_ID)).response);
    const { response } = await githubFlow(api, OUTSIDER_ID, "replace", session);
    expect(response.headers.get("location")).toBe("/sw/account/?error=state_invalid");
    expect(sessionPair(response)).toBe("");
    const ids = await sql<{ provider_uid: string }[]>`select provider_uid from identities`;
    expect(ids.map((i) => i.provider_uid)).toEqual([String(TESTER_ID)]);
    expect(await readSession(sql, session.split("=")[1])).not.toBeNull(); // nothing revoked
  });

  it("cannot move a recovery session's account onto an unlisted identity", async () => {
    const api = await startApi(allowlist());
    const signedIn = sessionPair((await githubFlow(api, TESTER_ID)).response);
    const code = await issueWith(api, signedIn);
    const redeemed = await post(api, "/api/auth/recovery", JSON.stringify({ code }));
    expect(redeemed.status).toBe(200);
    const { response } = await githubFlow(api, OUTSIDER_ID, "replace", sessionPair(redeemed));
    expect(sessionPair(response)).toBe("");
    const ids = await sql<{ provider_uid: string }[]>`select provider_uid from identities`;
    expect(ids.map((i) => i.provider_uid)).toEqual([String(TESTER_ID)]);
  });

  it("still moves an account onto another allowlisted identity and revokes old sessions", async () => {
    const api = await startApi(allowlist([TESTER_ID, SECOND_TESTER_ID]));
    const session = sessionPair((await githubFlow(api, TESTER_ID)).response);
    const { response } = await githubFlow(api, SECOND_TESTER_ID, "replace", session);
    expect(response.headers.get("location")).toBe("/sw/account/?replaced=github");
    expect(await readSession(sql, session.split("=")[1])).toBeNull();
    expect(await readSession(sql, sessionPair(response).split("=")[1])).not.toBeNull();
  });
});

describe("Nostr sign-in", () => {
  it("an allowlisted pubkey gets one account and a full session, and returns to the same account", async () => {
    const api = await startApi(allowlist());
    const first = await nostrLogin(api, await nostrChallenge(api));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ redirect: "/sw/account/welcome/" });
    const session = await readSession(sql, sessionPair(first).split("=")[1]);
    expect(session?.scope).toBe("full");

    const again = await nostrLogin(api, await nostrChallenge(api));
    expect(again.status).toBe(200);
    expect((await readSession(sql, sessionPair(again).split("=")[1]))?.accountId).toBe(session!.accountId);
    expect(await count("accounts")).toBe(1);
  });

  it("an unlisted pubkey with a valid signature creates nothing, and its challenge is spent", async () => {
    const api = await startApi(allowlist());
    const c = await nostrChallenge(api);
    const res = await nostrLogin(api, c, outsiderKey);
    expect(res.status).toBe(401);
    expect(sessionPair(res)).toBe("");
    expect(await count("accounts")).toBe(0);
    expect(await count("identities")).toBe(0);
    expect(await count("sessions")).toBe(0);
    expect(await usedAt(c.body.challengeId)).not.toBeNull();
  });

  it("the refusal is identical to an allowlisted pubkey replaying a spent challenge", async () => {
    const api = await startApi(allowlist());
    const denied = await nostrLogin(api, await nostrChallenge(api), outsiderKey);

    const c = await nostrChallenge(api);
    expect((await nostrLogin(api, c)).status).toBe(200);
    const replay = await nostrLogin(api, c);

    expect(denied.status).toBe(replay.status);
    expect(await denied.text()).toBe(await replay.text());
    expect(denied.headers.getSetCookie()).toEqual(replay.headers.getSetCookie());
  });

  it("an invalid signature gets the same answer for listed and unlisted pubkeys, before the challenge is touched", async () => {
    const api = await startApi(allowlist());
    const attempt = async (key: typeof testKey) => {
      const c = await nostrChallenge(api);
      const event = signedEvent(Buffer.from(c.raw), c.body.url, undefined, {}, [], key);
      event.sig = (event.sig[0] === "0" ? "1" : "0") + event.sig.slice(1);
      const res = await post(api, "/api/auth/nostr/verify", c.raw, c.pre, header(event));
      expect(await usedAt(c.body.challengeId)).toBeNull();
      return { status: res.status, body: await res.text() };
    };
    const listed = await attempt(testKey);
    const unlisted = await attempt(outsiderKey);
    expect(listed.status).toBe(401);
    expect(listed).toEqual(unlisted);
    expect(listed.body).toContain("nostr_invalid");
    expect(await count("accounts")).toBe(0);
  });
});

describe("recovery and existing sessions", () => {
  it("an allowlisted account can issue codes and redeem one for a recovery-scope session", async () => {
    const api = await startApi(allowlist());
    const session = sessionPair((await githubFlow(api, TESTER_ID)).response);
    const code = await issueWith(api, session);
    const res = await post(api, "/api/auth/recovery", JSON.stringify({ code }));
    expect(res.status).toBe(200);
    expect((await readSession(sql, sessionPair(res).split("=")[1]))?.scope).toBe("recovery");
  });

  it("a removed tester's valid code gets the wrong-code answer and is not spent", async () => {
    const before = await startApi(allowlist());
    const code = await issueWith(before, sessionPair((await githubFlow(before, TESTER_ID)).response));
    const sessions = await count("sessions");

    const after = await startApi(allowlist([SECOND_TESTER_ID]));
    const denied = await post(after, "/api/auth/recovery", JSON.stringify({ code }));
    const wrong = await post(after, "/api/auth/recovery", JSON.stringify({ code: generateCodes()[0] }));
    expect(denied.status).toBe(401);
    expect(denied.status).toBe(wrong.status);
    expect(await denied.text()).toBe(await wrong.text());
    expect(sessionPair(denied)).toBe("");
    expect(await count("sessions")).toBe(sessions);
    const spent = await sql`select 1 from recovery_codes where used_at is not null`;
    expect(spent.length).toBe(0);
  });

  it("a removed tester's full and recovery sessions stop working on every account route", async () => {
    const before = await startApi(allowlist());
    const signedIn = sessionPair((await githubFlow(before, TESTER_ID)).response);
    const code = await issueWith(before, signedIn);
    const recovery = sessionPair(await post(before, "/api/auth/recovery", JSON.stringify({ code })));
    const full = sessionPair((await githubFlow(before, TESTER_ID)).response);

    const after = await startApi(allowlist([SECOND_TESTER_ID]));
    for (const session of [full, recovery]) {
      expect((await get(`${after.base}/api/me`, session)).status).toBe(401);
      const regen = await fetch(`${after.base}/api/me/recovery-codes`, { method: "POST", headers: { origin: ORIGIN, "X-Jifunze": "1", cookie: session } });
      expect(regen.status).toBe(401);
      const reauth = await get(`${after.base}/api/auth/github/start?purpose=reauth&lang=sw`, session);
      expect(reauth.headers.get("location")).toBe("/sw/account/signin/?error=unauthenticated");
      const replace = await get(`${after.base}/api/auth/github/start?purpose=replace&lang=sw`, session);
      expect(replace.headers.get("location")).toBe("/sw/account/signin/?error=unauthenticated");
    }
  });

  it("a session on an account with only a revoked identity is refused", async () => {
    const accountId = await githubAccount(TESTER_ID);
    await sql`update identities set revoked_at = now() where account_id = ${accountId}`;
    const { cookie } = await createSession(sql, accountId, "full");
    const api = await startApi(allowlist());
    expect((await get(`${api.base}/api/me`, cookie.split(";")[0])).status).toBe(401);
  });

  it("a session on an account with no identity is refused", async () => {
    const [acct] = await sql<{ id: string }[]>`insert into accounts default values returning id`;
    const { cookie } = await createSession(sql, acct!.id, "full");
    const api = await startApi(allowlist());
    expect((await get(`${api.base}/api/me`, cookie.split(";")[0])).status).toBe(401);
  });

  it("with the allowlist off, every path behaves as before", async () => {
    const api = await startApi(null);
    const github = await githubFlow(api, OUTSIDER_ID);
    expect((await readSession(sql, sessionPair(github.response).split("=")[1]))?.scope).toBe("full");
    expect((await nostrLogin(api, await nostrChallenge(api), outsiderKey)).status).toBe(200);
    const code = await issueWith(api, sessionPair(github.response));
    expect((await post(api, "/api/auth/recovery", JSON.stringify({ code }))).status).toBe(200);
  });
});

describe("failing closed end to end", () => {
  const cfgFrom = (env: Record<string, string>) =>
    configWith(
      (({ testerAllowlist, testerAllowlistInvalid }) => ({ testerAllowlist, testerAllowlistInvalid }))(
        loadConfig({
          SITE_ORIGIN: ORIGIN,
          DATABASE_URL: "postgres://x",
          GITHUB_CLIENT_ID: "id",
          GITHUB_CLIENT_SECRET: "secret",
          RECOVERY_PEPPER_V1: Buffer.alloc(32, 1).toString("base64"),
          RAILWAY_ENVIRONMENT_NAME: "staging",
          ...env,
        }),
      ),
    );

  it.each([
    ["missing", {}],
    ["malformed", { TESTER_GITHUB_IDS: `${TESTER_ID},octocat`, TESTER_NOSTR_PUBKEYS: TESTER_PUBKEY }],
  ])("a %s list lets no identity sign in, while the API stays healthy", async (_name, env) => {
    const api = await startApi(null, undefined, cfgFrom(env)); // cfgFrom's list is the one in force
    expect((await get(`${api.base}/api/health`)).status).toBe(200);
    expect(sessionPair((await githubFlow(api, TESTER_ID)).response)).toBe("");
    expect((await nostrLogin(api, await nostrChallenge(api))).status).toBe(401);
    expect(await count("accounts")).toBe(0);
    expect(await count("sessions")).toBe(0);
  });
});

describe("existing rate limits", () => {
  it("refused Nostr identities still count toward the verify limit", async () => {
    const api = await startApi(allowlist(), fullRoutes({ nostrVerify: oneHit() }));
    expect((await nostrLogin(api, await nostrChallenge(api), outsiderKey)).status).toBe(401);
    expect((await nostrLogin(api, await nostrChallenge(api), outsiderKey)).status).toBe(429);
    expect((await nostrLogin(api, await nostrChallenge(api))).status).toBe(429);
  });

  it("refused recovery attempts still count toward the recovery limit", async () => {
    const before = await startApi(allowlist());
    const code = await issueWith(before, sessionPair((await githubFlow(before, TESTER_ID)).response));
    const after = await startApi(allowlist([SECOND_TESTER_ID]), fullRoutes({ recovery: oneHit() }));
    expect((await post(after, "/api/auth/recovery", JSON.stringify({ code }))).status).toBe(401);
    expect((await post(after, "/api/auth/recovery", JSON.stringify({ code }))).status).toBe(429);
  });

  it("the GitHub start limit is unchanged", async () => {
    const api = await startApi(allowlist(), fullRoutes({ githubStart: oneHit() }));
    await get(`${api.base}/api/auth/github/start?purpose=signin&lang=sw`);
    const second = await get(`${api.base}/api/auth/github/start?purpose=signin&lang=sw`);
    expect(second.headers.get("location")).toBe("/sw/account/signin/?error=rate_limited");
  });
});

describe("the canonical authentication origin", () => {
  /** node:http, because fetch does not let a caller choose the Host header. */
  const startWithHost = (port: number, host: string) =>
    new Promise<{ status: number; location: string }>((resolve, reject) => {
      httpGet({ port, host: "127.0.0.1", path: "/api/auth/github/start?purpose=signin&lang=sw", headers: { host } }, (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? "" });
      }).on("error", reject);
    });

  it("always sends GitHub back to the canonical origin, whatever Host the request used", async () => {
    const api = await startApi(allowlist());
    for (const host of [CANONICAL_HOST, new URL(GENERATED_ORIGIN).host]) {
      const { status, location } = await startWithHost(api.port, host);
      expect(status).toBe(302);
      expect(new URL(location).searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/github/callback`);
    }
  });

  it("refuses state-changing requests from the generated hostname's origin", async () => {
    const api = await startApi(allowlist());
    const c = await nostrChallenge(api);
    const event = header(signedEvent(Buffer.from(c.raw), c.body.url));
    for (const [path, body, auth] of [
      ["/api/auth/nostr/challenge", JSON.stringify({ lang: "sw" }), undefined],
      ["/api/auth/nostr/verify", c.raw, event],
      ["/api/auth/recovery", JSON.stringify({ code: generateCodes()[0] }), undefined],
    ] as const) {
      const res = await post(api, path, body, c.pre, auth, GENERATED_ORIGIN);
      expect(res.status).toBe(403);
      expect(await res.text()).toContain("bad_origin");
    }
    expect(await count("sessions")).toBe(0);
  });

  it("refuses an allowlisted pubkey's proof signed for the generated hostname", async () => {
    const api = await startApi(allowlist());
    const c = await nostrChallenge(api);
    const event = signedEvent(Buffer.from(c.raw), `${GENERATED_ORIGIN}/api/auth/nostr/verify`);
    const res = await post(api, "/api/auth/nostr/verify", c.raw, c.pre, header(event));
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("nostr_invalid");
    expect(await count("sessions")).toBe(0);
  });
});

describe("the proxy's tester gate", () => {
  const gate = (api: Api) => get(`${api.base}/api/internal/tester-gate`);

  it("answers 204 when the allowlist is in force, even one that denies everyone", async () => {
    expect((await gate(await startApi(allowlist(), routes))).status).toBe(204);
    expect((await gate(await startApi({ github: new Set(), nostr: new Set() }, routes))).status).toBe(204);
  });

  it("answers 404 when no allowlist is in force, so the proxy keeps authentication closed", async () => {
    const res = await gate(await startApi(null, routes));
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("not_found");
  });

  it("reveals nothing about the list", async () => {
    const res = await gate(await startApi(allowlist(), routes));
    expect(await res.text()).toBe("");
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe("no alternative session path", () => {
  it("createSession is called only by the four gated flows", () => {
    const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
    const callers = readdirSync(src)
      .filter((f) => f.endsWith(".ts"))
      .flatMap((file) => {
        const lines = readFileSync(join(src, file), "utf8").split("\n");
        return lines.flatMap((line, i) => {
          if (!/\bcreateSession\(/.test(line) || line.includes("export async function createSession")) return [];
          // The enclosing named function, or for recovery.ts the route that holds the call.
          const owner = lines.slice(0, i).reverse().find((l) => /export async function |const \w+: Route = /.test(l)) ?? "";
          return [`${file}:${/(?:function |const )(\w+)/.exec(owner)?.[1]}`];
        });
      });
    expect(callers.sort()).toEqual([
      "accounts.ts:replaceGithubIdentity",
      "accounts.ts:signInWithGithub",
      "accounts.ts:signInWithNostr",
      "recovery.ts:redeem",
    ]);
  });
});
