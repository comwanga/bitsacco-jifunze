import type { AddressInfo } from "node:net";
import { schnorr } from "@noble/curves/secp256k1.js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signInWithGithub } from "../src/accounts.ts";
import { loadConfig } from "../src/config.ts";
import { connect, migrate } from "../src/db.ts";
import { deleteAccountRoute } from "../src/delete-route.ts";
import { createServer, PREAUTH_COOKIE, SESSION_COOKIE, type Route } from "../src/http.ts";
import { nostrRoutes } from "../src/nostr-routes.ts";
import { Limiter, perIp } from "../src/ratelimit.ts";
import { issueCodes, recoveryRoutes } from "../src/recovery.ts";
import { routesFor } from "../src/routes.ts";
import { logoutAllRoute, logoutRoute, meRoute, readSession, setSessionSameSite } from "../src/sessions.ts";
import { fakeConfig, ORIGIN, resetTestDb, testDatabaseUrl } from "./helpers.ts";
import { header, signedEvent, testKey } from "./nostr-helper.ts";

// Stage 1 of the Nostr-first design: re-authentication, key replacement, sign-out everywhere and deletion.

const sql = connect(testDatabaseUrl());
const logs: unknown[] = [];
const cfg = fakeConfig();
const unlimited = () => new Limiter([]);
const servers: { close: () => Promise<void> }[] = [];
async function serve(routes: Route[], config = cfg): Promise<string> {
  const server = createServer(routes, { cfg: config, sql, readSession, log: (l) => logs.push(l), logError: (l) => logs.push(l) });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  servers.push({ close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const appRoutes = (replaces = unlimited()): Route[] => [
  meRoute, logoutRoute, logoutAllRoute, deleteAccountRoute(unlimited()),
  ...nostrRoutes(unlimited(), unlimited(), replaces), ...recoveryRoutes(unlimited()),
];
let base = await serve(appRoutes());
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
const pub = (k: Key) => Buffer.from(schnorr.getPublicKey(k)).toString("hex");
const K1 = key(11), K2 = key(12), K3 = key(13);
const pair = (r: Response, name: string) => r.headers.getSetCookie().find((c) => c.startsWith(name + "="))?.split(";")[0] ?? "";
const join = (...cookies: string[]) => cookies.filter(Boolean).join("; ");
function post(path: string, body: string, cookie = "", authorization?: string, at = base) {
  return fetch(at + path, { method: "POST", headers: { origin: ORIGIN, "X-Jifunze": "1", "Content-Type": "application/json", cookie, ...(authorization ? { authorization } : {}) }, body });
}
const get = (path: string, cookie = "", at = base) => fetch(at + path, { headers: { cookie } });
const errorCode = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;

type Challenge = { raw: string; url: string; pre: string; id: string; nonce: string };
async function challenge(purpose: "signin" | "reauth" | "replace", session = "", at = base): Promise<Challenge> {
  const r = await post("/api/auth/nostr/challenge", JSON.stringify({ lang: "en", returnTo: "/en/account/", purpose }), session, undefined, at);
  expect(r.status).toBe(200);
  const b = await r.json() as { challengeId: string; nonce: string; url: string };
  return { raw: JSON.stringify({ challengeId: b.challengeId, nonce: b.nonce }), url: b.url, pre: pair(r, PREAUTH_COOKIE), id: b.challengeId, nonce: b.nonce };
}
/** Sends the proof for `c` signed by `k` to the path in its own URL (or to `path`, to test misuse). */
function prove(c: Challenge, k: Key, session = "", path = new URL(c.url).pathname, at = base) {
  return post(path, c.raw, join(session, c.pre), header(signedEvent(Buffer.from(c.raw), c.url, undefined, {}, [], k)), at);
}
/** A signed-in full session for `k`: its cookie pair and account id. */
async function signIn(k: Key, at = base): Promise<{ cookie: string; accountId: string }> {
  const r = await prove(await challenge("signin", "", at), k, "", undefined, at);
  expect(r.status).toBe(200);
  const cookie = pair(r, SESSION_COOKIE);
  return { cookie, accountId: (await readSession(sql, cookie.split("=")[1]))!.accountId };
}
const staleReauth = () => sql`update sessions set reauth_at = now() - interval '11 minutes'`;
const nostrKeyOf = async (accountId: string) =>
  (await sql<{ provider_uid: string }[]>`select provider_uid from identities where account_id = ${accountId} and provider = 'nostr'`)[0]?.provider_uid;
const liveSessions = async (accountId: string) =>
  Number((await sql`select count(*) as n from sessions where account_id = ${accountId} and revoked_at is null`)[0]!.n);
const count = async (table: string) => Number((await sql.unsafe(`select count(*) as n from ${table}`))[0]!.n);
/** Issues the first set of recovery codes and opens a recovery session with one of them. */
async function recover(accountId: string): Promise<{ cookie: string; codes: string[] }> {
  const codes = await issueCodes(sql, cfg, accountId, { initial: true });
  const r = await post("/api/auth/recovery", JSON.stringify({ code: codes[0] }));
  expect(r.status).toBe(200);
  return { cookie: pair(r, SESSION_COOKIE), codes };
}

describe("a deployment without a GitHub App", () => {
  const env = { SITE_ORIGIN: ORIGIN, DATABASE_URL: "postgres://fake", RECOVERY_PEPPER_V1: Buffer.alloc(32, 3).toString("base64") };

  it("loads its configuration with GitHub off, and refuses half a credential by key name only", () => {
    const off = loadConfig(env);
    expect(off.githubEnabled).toBe(false);
    expect(off.githubClientId).toBe("");
    expect(loadConfig({ ...env, GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" }).githubEnabled).toBe(true);
    for (const [given, missing] of [["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"], ["GITHUB_CLIENT_SECRET", "GITHUB_CLIENT_ID"]] as const) {
      let message = "";
      try { loadConfig({ ...env, [given]: "half-a-credential-value" }); } catch (e) { message = (e as Error).message; }
      expect(message).toContain(missing);
      expect(message).not.toContain("half-a-credential-value");
    }
  });

  it("serves no GitHub path and still signs in with Nostr", async () => {
    const nostrOnly = fakeConfig({ githubEnabled: false, githubClientId: "", githubClientSecret: "" });
    const at = await serve(routesFor(nostrOnly), nostrOnly);
    for (const path of ["/api/auth/github/start?purpose=signin&lang=en", "/api/auth/github/callback?code=x&state=y", "/api/auth/github/callback/reauth", "/api/auth/github/callback/replace"]) {
      const r = await get(path, "", at);
      expect(r.status).toBe(404);
      expect(r.headers.get("location")).toBeNull();
    }
    const { accountId } = await signIn(K1, at);
    expect(await nostrKeyOf(accountId)).toBe(pub(K1));
    expect(routesFor(fakeConfig()).some((r) => r.path.startsWith("/api/auth/github/"))).toBe(true);
  });

  it("issues a SameSite=Strict session cookie, and keeps Lax only while GitHub needs the redirect", async () => {
    const attrs = async () => {
      const r = await prove(await challenge("signin"), K1);
      return r.headers.getSetCookie().find((c) => c.startsWith(SESSION_COOKIE + "="))!.split("; ").slice(1).join("; ");
    };
    expect(await attrs()).toBe("HttpOnly; Secure; SameSite=Lax; Path=/");
    setSessionSameSite("Strict");
    try {
      expect(await attrs()).toBe("HttpOnly; Secure; SameSite=Strict; Path=/");
    } finally {
      setSessionSameSite("Lax");
    }
  });
});

describe("Nostr re-authentication", () => {
  it("refreshes only the asking session, with the account's own key, once", async () => {
    const a = await signIn(K1);
    const other = await signIn(K1); // a second device of the same account
    await staleReauth();
    const c = await challenge("reauth", a.cookie);
    expect(c.url).toBe(ORIGIN + "/api/auth/nostr/reauth");
    const r = await prove(c, K1, a.cookie);
    expect(r.status).toBe(204);
    const fresh = await sql<{ token_hash: Buffer; fresh: boolean }[]>`select token_hash, reauth_at > now() - interval '1 minute' as fresh from sessions`;
    const hashOf = async (cookie: string) => (await readSession(sql, cookie.split("=")[1]))!.tokenHash;
    expect(fresh.find((s) => s.token_hash.equals(Buffer.alloc(0)))).toBeUndefined();
    const aHash = await hashOf(a.cookie), otherHash = await hashOf(other.cookie);
    expect(fresh.find((s) => s.token_hash.equals(aHash))!.fresh).toBe(true);
    expect(fresh.find((s) => s.token_hash.equals(otherHash))!.fresh).toBe(false);
    // Single use: the same proof again is refused and changes nothing.
    await staleReauth();
    expect(await errorCode(await prove(c, K1, a.cookie))).toBe("challenge_invalid");
    expect(Number((await sql`select count(*) as n from sessions where reauth_at > now() - interval '1 minute'`)[0]!.n)).toBe(0);
    expect((await sql`select event from security_events where event = 'reauth'`).length).toBe(1);
  });

  it("refuses another key, spends the challenge and leaves the session stale", async () => {
    const a = await signIn(K1);
    await staleReauth();
    const c = await challenge("reauth", a.cookie);
    const wrong = await prove(c, K2, a.cookie);
    expect(wrong.status).toBe(403);
    expect(await errorCode(wrong)).toBe("nostr_key_mismatch");
    expect((await sql`select used_at from auth_challenges where id = ${c.id}`)[0]!.used_at).not.toBeNull();
    // The right key can no longer use the burnt challenge either.
    expect((await prove(c, K1, a.cookie)).status).toBe(401);
    expect(Number((await sql`select count(*) as n from sessions where reauth_at > now() - interval '1 minute'`)[0]!.n)).toBe(0);
  });

  it("binds a challenge to its purpose, its session and its browser", async () => {
    const a = await signIn(K1);
    const b = await signIn(K2);
    await staleReauth();
    // Unauthenticated and recovery sessions cannot ask for one.
    expect((await post("/api/auth/nostr/challenge", JSON.stringify({ lang: "en", purpose: "reauth" }))).status).toBe(401);
    expect((await post("/api/auth/nostr/challenge", JSON.stringify({ lang: "en", purpose: "replace" }))).status).toBe(401);
    const recovery = await recover(b.accountId);
    const refused = await post("/api/auth/nostr/challenge", JSON.stringify({ lang: "en", purpose: "reauth" }), recovery.cookie);
    expect(await errorCode(refused)).toBe("recovery_scope");

    const a2 = await signIn(K1);
    await staleReauth();
    const c = await challenge("reauth", a2.cookie);
    // A proof signed for the reauth URL is not a sign-in or a replacement.
    expect((await prove(c, K1, a2.cookie, "/api/auth/nostr/verify")).status).toBe(401);
    expect((await prove(c, K1, a2.cookie, "/api/auth/nostr/replace")).status).toBe(401);
    // A sign-in challenge is not a re-authentication, even when signed for the reauth URL.
    const signin = await challenge("signin");
    const forged = { ...signin, url: ORIGIN + "/api/auth/nostr/reauth" };
    expect(await errorCode(await prove(forged, K1, a2.cookie))).toBe("challenge_invalid");
    // Another session of the same account, another account, or another browser cannot spend it.
    expect(await errorCode(await prove(c, K1, a.cookie))).toBe("challenge_invalid");
    const third = await signIn(K3);
    expect(await errorCode(await prove(c, K3, third.cookie))).toBe("challenge_invalid");
    expect(await errorCode(await prove({ ...c, pre: `${PREAUTH_COOKIE}=${"a".repeat(43)}` }, K1, a2.cookie))).toBe("challenge_invalid");
    expect((await prove(c, K1, "")).status).toBe(401); // no session at all
    expect((await sql`select used_at from auth_challenges where id = ${c.id}`)[0]!.used_at).toBeNull();
    // Expired challenges are refused.
    await sql`update auth_challenges set expires_at = now() - interval '1 second' where id = ${c.id}`;
    expect(await errorCode(await prove(c, K1, a2.cookie))).toBe("challenge_invalid");
    // None of the refused attempts refreshed the session the challenge belonged to (or the first one).
    for (const cookie of [a.cookie, a2.cookie]) {
      const { tokenHash } = (await readSession(sql, cookie.split("=")[1]))!;
      expect((await sql`select reauth_at > now() - interval '1 minute' as fresh from sessions where token_hash = ${tokenHash}`)[0]!.fresh).toBe(false);
    }
  });
});

describe("Nostr key replacement", () => {
  it("after a recovery code: the new key takes over the same account and every old session ends", async () => {
    const before = await signIn(K1);
    const device2 = await signIn(K1);
    const recovery = await recover(before.accountId);
    expect(await liveSessions(before.accountId)).toBe(1); // redeeming a code already ended the full sessions
    const c = await challenge("replace", recovery.cookie);
    expect(c.url).toBe(ORIGIN + "/api/auth/nostr/replace");
    const r = await prove(c, K2, recovery.cookie);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ redirect: "/en/account/", outcome: "replaced" });
    const fresh = pair(r, SESSION_COOKIE);
    const session = await readSession(sql, fresh.split("=")[1]);
    expect(session).toMatchObject({ accountId: before.accountId, scope: "full" });
    expect(await nostrKeyOf(before.accountId)).toBe(pub(K2));
    expect(await count("identities")).toBe(1);
    expect(await liveSessions(before.accountId)).toBe(1);
    for (const old of [before.cookie, device2.cookie, recovery.cookie]) expect((await get("/api/me", old)).status).toBe(401);
    expect((await get("/api/me", fresh)).status).toBe(200);
    // The new key signs in to this account; the old key no longer reaches it.
    expect((await signIn(K2)).accountId).toBe(before.accountId);
    expect((await signIn(K1)).accountId).not.toBe(before.accountId);
    // Replay of the same proof, even from the fresh session, is refused.
    expect(await errorCode(await prove(c, K2, fresh))).toBe("challenge_invalid");
    const events = await sql<{ detail: Record<string, string> }[]>`select detail from security_events where event = 'identity_replaced'`;
    expect(events.map((e) => e.detail)).toEqual([{ provider: "nostr", outcome: "replaced" }]);
  });

  it("from a full session only after a fresh re-authentication", async () => {
    const a = await signIn(K1);
    await staleReauth();
    const c = await challenge("replace", a.cookie);
    const stale = await prove(c, K2, a.cookie);
    expect(stale.status).toBe(403);
    expect(await errorCode(stale)).toBe("reauth_required");
    expect(await nostrKeyOf(a.accountId)).toBe(pub(K1));
    expect(await liveSessions(a.accountId)).toBe(1);
    expect((await sql`select used_at from auth_challenges where id = ${c.id}`)[0]!.used_at).toBeNull(); // rolled back
    expect((await prove(await challenge("reauth", a.cookie), K1, a.cookie)).status).toBe(204);
    const ok = await prove(c, K2, a.cookie);
    expect(ok.status).toBe(200);
    expect(await nostrKeyOf(a.accountId)).toBe(pub(K2));
    expect((await get("/api/me", a.cookie)).status).toBe(401); // the initiating session is revoked too
  });

  it("never lets one account take or change another account's identity", async () => {
    const victim = await signIn(K1);
    const attacker = await signIn(K2);
    const attackerRecovery = await recover(attacker.accountId);
    // 1. A key that already belongs to another account is refused, and nothing changes for either.
    const taken = await prove(await challenge("replace", attackerRecovery.cookie), K1, attackerRecovery.cookie);
    expect(taken.status).toBe(409);
    expect(await errorCode(taken)).toBe("identity_in_use");
    expect(await nostrKeyOf(victim.accountId)).toBe(pub(K1));
    expect(await nostrKeyOf(attacker.accountId)).toBe(pub(K2));
    expect((await get("/api/me", victim.cookie)).status).toBe(200);
    expect((await get("/api/me", attackerRecovery.cookie)).status).toBe(200);
    // 2. A challenge created by the victim's session cannot be spent by the attacker's session...
    const victimRecovery = await recover(victim.accountId);
    const stolen = await challenge("replace", victimRecovery.cookie);
    expect(await errorCode(await prove(stolen, K3, attackerRecovery.cookie))).toBe("challenge_invalid");
    // ...and the attacker's own valid replacement only ever changes the attacker's account.
    const own = await prove(await challenge("replace", attackerRecovery.cookie), K3, attackerRecovery.cookie);
    expect(own.status).toBe(200);
    expect(await nostrKeyOf(attacker.accountId)).toBe(pub(K3));
    expect(await nostrKeyOf(victim.accountId)).toBe(pub(K1));
    expect((await sql`select used_at from auth_challenges where id = ${stolen.id}`)[0]!.used_at).toBeNull();
    // 3. No request field can name an account: extra fields make the proof invalid.
    const c = await challenge("replace", victimRecovery.cookie);
    const raw = JSON.stringify({ challengeId: c.id, nonce: c.nonce, accountId: attacker.accountId });
    const extra = await post("/api/auth/nostr/replace", raw, join(victimRecovery.cookie, c.pre), header(signedEvent(Buffer.from(raw), c.url, undefined, {}, [], key(14))));
    expect(extra.status).toBe(401);
    expect(await nostrKeyOf(victim.accountId)).toBe(pub(K1));
  });

  it("is atomic under concurrent attempts: exactly one key wins and one session survives", async () => {
    const a = await signIn(K1);
    const recovery = await recover(a.accountId);
    const keys = [K2, K3, key(15), key(16)];
    const challenges = [];
    for (const k of keys) challenges.push({ k, c: await challenge("replace", recovery.cookie) });
    const results = await Promise.all(challenges.map(({ k, c }) => prove(c, k, recovery.cookie)));
    const ok = results.filter((r) => r.status === 200);
    expect(ok.length).toBe(1);
    for (const r of results.filter((x) => x.status !== 200)) expect([401, 409]).toContain(r.status);
    const winner = keys[results.findIndex((r) => r.status === 200)]!;
    expect(await nostrKeyOf(a.accountId)).toBe(pub(winner));
    expect(Number((await sql`select count(*) as n from identities where account_id = ${a.accountId}`)[0]!.n)).toBe(1);
    expect(await liveSessions(a.accountId)).toBe(1);
    expect((await sql`select 1 from security_events where event = 'identity_replaced'`).length).toBe(1);
  });

  it("two accounts racing for the same new key: one gets it, the other is refused whole", async () => {
    const a = await signIn(K1), b = await signIn(K2);
    const ra = await recover(a.accountId), rb = await recover(b.accountId);
    const [ca, cb] = [await challenge("replace", ra.cookie), await challenge("replace", rb.cookie)];
    const [xa, xb] = await Promise.all([prove(ca, K3, ra.cookie), prove(cb, K3, rb.cookie)]);
    expect([xa.status, xb.status].sort()).toEqual([200, 409]);
    const owners = await sql<{ account_id: string }[]>`select account_id from identities where provider_uid = ${pub(K3)}`;
    expect(owners.length).toBe(1);
    const loser = xa.status === 200 ? b : a;
    expect(await nostrKeyOf(loser.accountId)).toBe(pub(xa.status === 200 ? K2 : K1)); // untouched
    expect(await count("identities")).toBe(2);
  });

  it("keeps the same key as 'unchanged', refuses accounts with no Nostr identity, and is rate limited", async () => {
    const a = await signIn(K1);
    const ra = await recover(a.accountId);
    const same = await prove(await challenge("replace", ra.cookie), K1, ra.cookie);
    expect(((await same.json()) as { outcome: string }).outcome).toBe("unchanged");
    expect(await nostrKeyOf(a.accountId)).toBe(pub(K1));

    const gh = await signInWithGithub(sql, { id: 4242, login: "octo", avatarUrl: "" }, "en", null);
    const ghCookie = gh.cookie.split(";")[0]!;
    const linking = await prove(await challenge("replace", ghCookie), K2, ghCookie);
    expect(linking.status).toBe(403);
    expect(await errorCode(linking)).toBe("nostr_lifecycle_pending");
    expect(await nostrKeyOf(gh.accountId)).toBeUndefined();

    const limited = await serve(appRoutes(new Limiter([{ name: "t", key: perIp, limit: 1, windowMs: 60_000 }])));
    const b = await signIn(K2, limited);
    const c = await challenge("replace", b.cookie, limited);
    expect((await prove(c, K3, b.cookie, undefined, limited)).status).toBe(200);
    const b2 = await signIn(K3, limited);
    const second = await prove(await challenge("replace", b2.cookie, limited), key(17), b2.cookie, undefined, limited);
    expect(second.status).toBe(429);
    expect(await nostrKeyOf(b.accountId)).toBe(pub(K3));
  });

  it("applies the tester allowlist to the new key and spends the challenge", async () => {
    const testers = fakeConfig({ testerAllowlist: { github: new Set(), nostr: new Set([pub(K1)]) } });
    const at = await serve(appRoutes(), testers);
    const a = await signIn(K1, at);
    const c = await challenge("replace", a.cookie, at);
    const r = await prove(c, K2, a.cookie, undefined, at);
    expect(await errorCode(r)).toBe("challenge_invalid");
    expect((await sql`select used_at from auth_challenges where id = ${c.id}`)[0]!.used_at).not.toBeNull();
    expect(await nostrKeyOf(a.accountId)).toBe(pub(K1));
  });
});

describe("sign out everywhere", () => {
  it("ends every session of this account and no other", async () => {
    const a1 = await signIn(K1), a2 = await signIn(K1), b = await signIn(K2);
    const r = await post("/api/auth/logout/all", "", a1.cookie);
    expect(r.status).toBe(204);
    expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await get("/api/me", a1.cookie)).status).toBe(401);
    expect((await get("/api/me", a2.cookie)).status).toBe(401);
    expect((await get("/api/me", b.cookie)).status).toBe(200);
    expect((await post("/api/auth/logout/all", "")).status).toBe(401);
    const [event] = await sql<{ account_id: string; detail: Record<string, string> }[]>`select account_id, detail from security_events where event = 'signout_all'`;
    expect(event).toMatchObject({ account_id: a1.accountId, detail: { sessions: "2" } });
  });
});

describe("account deletion", () => {
  it("needs a full, freshly re-authenticated session and an explicit confirmation", async () => {
    const a = await signIn(K1);
    expect((await post("/api/me/delete", JSON.stringify({ confirm: true }))).status).toBe(401);
    expect((await post("/api/me/delete", "{}", a.cookie)).status).toBe(400);
    expect((await post("/api/me/delete", JSON.stringify({ confirm: true, accountId: "x" }), a.cookie)).status).toBe(400);
    await staleReauth();
    const stale = await post("/api/me/delete", JSON.stringify({ confirm: true }), a.cookie);
    expect(await errorCode(stale)).toBe("reauth_required");
    const recovery = await recover(a.accountId);
    expect(await errorCode(await post("/api/me/delete", JSON.stringify({ confirm: true }), recovery.cookie))).toBe("recovery_scope");
    expect(await count("accounts")).toBe(1);
  });

  it("removes the account and everything attached to it, and nothing of anyone else", async () => {
    const a = await signIn(K1), b = await signIn(K2);
    await issueCodes(sql, cfg, a.accountId, { initial: true });
    await issueCodes(sql, cfg, b.accountId, { initial: true });
    await challenge("reauth", a.cookie); // an unspent challenge bound to the account
    const r = await post("/api/me/delete", JSON.stringify({ confirm: true }), a.cookie);
    expect(r.status).toBe(204);
    expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
    for (const table of ["accounts", "identities", "sessions", "recovery_codes", "auth_challenges"]) {
      const column = table === "accounts" ? "id" : "account_id";
      expect(Number((await sql.unsafe(`select count(*) as n from ${table} where ${column} = '${a.accountId}'`))[0]!.n)).toBe(0);
    }
    expect((await get("/api/me", a.cookie)).status).toBe(401);
    // The other account is whole.
    expect((await get("/api/me", b.cookie)).status).toBe(200);
    expect(await nostrKeyOf(b.accountId)).toBe(pub(K2));
    expect(Number((await sql`select count(*) as n from recovery_codes where account_id = ${b.accountId}`)[0]!.n)).toBe(10);
    // Events survive without the account; the deletion record names nobody.
    expect(Number((await sql`select count(*) as n from security_events where account_id = ${a.accountId}`)[0]!.n)).toBe(0);
    const [deleted] = await sql<{ account_id: string | null; detail: object }[]>`select account_id, detail from security_events where event = 'account_deleted'`;
    expect(deleted).toEqual({ account_id: null, detail: {} });
    // The same key later starts a new, empty account.
    expect((await signIn(K1)).accountId).not.toBe(a.accountId);
  });
});

describe("sensitive data", () => {
  it("never reaches request logs or security events", async () => {
    const a = await signIn(K1);
    const recovery = await recover(a.accountId);
    const c = await challenge("replace", recovery.cookie);
    const r = await prove(c, K2, recovery.cookie);
    expect(r.status).toBe(200);
    const fresh = pair(r, SESSION_COOKIE);
    await prove(await challenge("reauth", fresh), K2, fresh);
    await post("/api/auth/logout/all", "", fresh);
    const written = JSON.stringify(logs) + JSON.stringify(await sql`select event, detail from security_events`);
    const secrets = [
      pub(K1), pub(K2), c.nonce, c.pre.split("=")[1]!, a.cookie.split("=")[1]!, recovery.cookie.split("=")[1]!, fresh.split("=")[1]!,
      ...recovery.codes, ...recovery.codes.map((code) => code.replace(/-/g, "")),
      Buffer.from(K1).toString("hex"), Buffer.from(K2).toString("hex"),
    ];
    for (const secret of secrets) expect(written).not.toContain(secret);
    expect(written).toContain("/api/auth/nostr/replace"); // route templates are what is logged
  });
});
