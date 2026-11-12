import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, expect, it } from "vitest";
import { connect, migrate } from "../src/db.ts";
import { createServer, PREAUTH_COOKIE, SESSION_COOKIE } from "../src/http.ts";
import { nostrRoutes } from "../src/nostr-routes.ts";
import { replaceGithubIdentity, signInWithGithub } from "../src/accounts.ts";
import { routes } from "../src/routes.ts";
import { readSession } from "../src/sessions.ts";
import { fakeConfig, ORIGIN, resetTestDb, testDatabaseUrl } from "./helpers.ts";
import { header, signedEvent, testKey } from "./nostr-helper.ts";
import { Limiter, perIp } from "../src/ratelimit.ts";

const sql = connect(testDatabaseUrl());
const logs: unknown[] = [];
const cfg = fakeConfig();
const testRoutes = [...routes.filter((r) => !r.path.startsWith("/api/auth/nostr/")), ...nostrRoutes(new Limiter([]), new Limiter([]))];
const server = createServer(testRoutes, { cfg, sql, readSession, log: (l) => logs.push(l), logError: (l) => logs.push(l) });
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await sql.end();
});
beforeEach(async () => {
  logs.length = 0;
  await resetTestDb(sql);
  await migrate(sql, new URL("../migrations/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
});
const pair = (r: Response, name: string) => r.headers.getSetCookie().find((c) => c.startsWith(name + "="))?.split(";")[0] ?? "";
const post = (path: string, body: string, cookie = "", authorization?: string, origin = ORIGIN) => fetch(base + path, {
  method: "POST", headers: { origin, "X-Jifunze": "1", "Content-Type": "application/json", cookie, ...(authorization ? { authorization } : {}) }, body,
});
async function challenge(over: Record<string, unknown> = {}) {
  const response = await post("/api/auth/nostr/challenge", JSON.stringify({ lang: "sw", returnTo: "/sw/account/", ...over }));
  expect(response.status).toBe(200);
  const body = await response.json() as { challengeId: string; nonce: string; url: string };
  return { response, body, raw: JSON.stringify({ challengeId: body.challengeId, nonce: body.nonce }), pre: pair(response, PREAUTH_COOKIE) };
}
async function login(c: Awaited<ReturnType<typeof challenge>>, key = testKey, cookie = c.pre) {
  return post("/api/auth/nostr/verify", c.raw, cookie, header(signedEvent(Buffer.from(c.raw), c.body.url, undefined, {}, [], key)));
}
async function me(r: Response) { return readSession(sql, pair(r, SESSION_COOKIE).split("=")[1]); }
const count = async (table: "accounts" | "identities" | "sessions") => Number((await sql.unsafe(`select count(*) as n from ${table}`))[0]!.n);

it("creates a five-minute challenge with hashed nonce and binding and existing secure cookie", async () => {
  const c = await challenge();
  const [row] = await sql`select *, extract(epoch from expires_at - created_at)::int as lifetime from auth_challenges`;
  expect(row!.lifetime).toBe(300);
  expect(row!.purpose).toBe("signin"); expect(row!.provider).toBe("nostr");
  expect(row!.secret_hash).toEqual(createHash("sha256").update(c.body.nonce).digest());
  expect(row!.binding_hash).toEqual(createHash("sha256").update(c.pre.split("=")[1]!).digest());
  expect(c.body.url).toBe(ORIGIN + "/api/auth/nostr/verify");
  expect(c.response.headers.get("set-cookie")).toContain("HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=300");
  expect(c.response.headers.get("cache-control")).toBe("no-store");
  expect(JSON.stringify(logs)).not.toContain(c.body.nonce);
});

it("creates one internal account and full session; returning pubkey retrieves the same account", async () => {
  const first = await login(await challenge()); expect(first.status).toBe(200);
  expect(await first.json()).toEqual({ redirect: "/sw/account/welcome/" });
  const session = await me(first); expect(session?.scope).toBe("full");
  const c = await challenge({ lang: "en", returnTo: "/en/progress/" });
  const again = await login(c); expect(again.status).toBe(200);
  expect(await again.json()).toEqual({ redirect: "/en/progress/" });
  expect((await me(again))!.accountId).toBe(session!.accountId);
  expect(await count("accounts")).toBe(1); expect(await count("identities")).toBe(1);
  expect(first.headers.get("set-cookie")).toContain("HttpOnly; Secure; SameSite=Lax; Path=/");
});

it("rejects invalid events before consumption; attacker cannot burn a valid challenge", async () => {
  const c = await challenge();
  const e = signedEvent(Buffer.from(c.raw), c.body.url);
  for (const authorization of ["Nostr !!!", header({ ...e, sig: "0".repeat(128) }), header({ ...e, id: "f".repeat(64) })]) {
    expect((await post("/api/auth/nostr/verify", c.raw, c.pre, authorization)).status).toBe(401);
    expect((await sql`select used_at from auth_challenges`)[0]!.used_at).toBeNull();
  }
  expect((await login(c)).status).toBe(200);
});

it("requires the exact origin, no query, correct nonce and browser cookie, purpose and provider", async () => {
  const c = await challenge();
  const e = header(signedEvent(Buffer.from(c.raw), c.body.url));
  expect((await post("/api/auth/nostr/verify", c.raw, c.pre, e, "https://evil.test")).status).toBe(403);
  expect((await post("/api/auth/nostr/verify?x=1", c.raw, c.pre, e)).status).toBe(401);
  for (const cookie of ["", `${PREAUTH_COOKIE}=${"a".repeat(43)}`]) expect((await login(c, testKey, cookie)).status).toBe(401);
  const wrongNonce = JSON.stringify({ challengeId: c.body.challengeId, nonce: "a".repeat(43) });
  expect((await post("/api/auth/nostr/verify", wrongNonce, c.pre, header(signedEvent(Buffer.from(wrongNonce), c.body.url)))).status).toBe(401);
  await sql`update auth_challenges set provider = 'github'`;
  expect((await login(c)).status).toBe(401);
  await sql`update auth_challenges set provider = 'nostr', purpose = 'link', session_token_hash = ${Buffer.alloc(32)}`;
  expect((await login(c)).status).toBe(401);
  expect(await count("accounts")).toBe(0);
});

it("rejects expired and replayed challenges", async () => {
  const c = await challenge();
  await sql`update auth_challenges set expires_at = now() - interval '1 second'`;
  expect((await login(c)).status).toBe(401);
  const fresh = await challenge(); expect((await login(fresh)).status).toBe(200);
  expect((await login(fresh)).status).toBe(401);
  expect(await count("sessions")).toBe(1);
});

it("20 concurrent valid uses yield exactly one success, account and session", async () => {
  const c = await challenge();
  const results = await Promise.all(Array.from({ length: 20 }, () => login(c)));
  expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  expect(results.filter((r) => r.status === 401)).toHaveLength(19);
  expect(await count("accounts")).toBe(1); expect(await count("sessions")).toBe(1);
});

it("independent concurrent challenges for one pubkey never create duplicate accounts", async () => {
  const challenges = await Promise.all(Array.from({ length: 5 }, () => challenge()));
  const results = await Promise.all(challenges.map((c) => login(c)));
  expect(results.every((r) => r.status === 200)).toBe(true);
  expect(await count("accounts")).toBe(1); expect(await count("identities")).toBe(1);
});

it("rolls back challenge, account, identity, previous-session revocation and audit on session failure", async () => {
  const c = await challenge();
  await sql`alter table sessions add constraint injected_failure check (false)`;
  expect((await login(c)).status).toBe(500);
  expect(await count("accounts")).toBe(0); expect(await count("identities")).toBe(0);
  expect((await sql`select used_at from auth_challenges`)[0]!.used_at).toBeNull();
  expect((await sql`select * from security_events`)).toHaveLength(0);
  await sql`alter table sessions drop constraint injected_failure`;
  expect((await login(c)).status).toBe(200);
});

it("does not link or merge a Nostr identity into a signed-in GitHub account; revokes old browser session", async () => {
  const gh = await signInWithGithub(sql, { id: 42, login: "same-name", avatarUrl: "" }, "en", null);
  const old = gh.cookie.split(";")[0]!;
  const c = await challenge(); const r = await login(c, testKey, c.pre + "; " + old);
  expect(r.status).toBe(200); expect((await me(r))!.accountId).not.toBe(gh.accountId);
  expect(await readSession(sql, old.split("=")[1])).toBeNull();
  expect(await count("accounts")).toBe(2);
  expect((await sql`select provider from identities where account_id = ${gh.accountId}`)[0]!.provider).toBe("github");
});

it("rolls back previous-session revocation and challenge use if audit writing fails", async () => {
  const first = await login(await challenge());
  const old = pair(first, SESSION_COOKIE);
  const c = await challenge();
  await sql`alter table security_events add constraint injected_audit_failure check (false) not valid`;
  expect((await login(c, testKey, c.pre + "; " + old)).status).toBe(500);
  expect(await me(first)).not.toBeNull();
  expect(await count("sessions")).toBe(1);
  expect((await sql`select used_at from auth_challenges where id = ${c.body.challengeId}`)[0]!.used_at).toBeNull();
  await sql`alter table security_events drop constraint injected_audit_failure`;
  expect((await login(c, testKey, c.pre + "; " + old)).status).toBe(200);
  expect(await me(first)).toBeNull();
});

it("refuses a deleted account without consuming its challenge or creating a session", async () => {
  await login(await challenge());
  await sql`update accounts set deleted_at = now()`;
  const c = await challenge();
  expect((await login(c)).status).toBe(401);
  expect(await count("sessions")).toBe(1);
  expect((await sql`select used_at from auth_challenges where id = ${c.body.challengeId}`)[0]!.used_at).toBeNull();
});

it("issues exactly ten initial recovery codes once, redeeming revokes Nostr sessions and limits scope", async () => {
  const r = await login(await challenge()); const cookie = pair(r, SESSION_COOKIE);
  const issued = await post("/api/me/recovery-codes/initial", "", cookie);
  expect(issued.status).toBe(200);
  const { codes } = await issued.json() as { codes: string[] }; expect(codes).toHaveLength(10);
  expect((await post("/api/me/recovery-codes/initial", "", cookie)).status).toBe(409);
  const redeemed = await post("/api/auth/recovery", JSON.stringify({ code: codes[0] }));
  expect(redeemed.status).toBe(200); const recovery = await me(redeemed);
  expect(recovery!.scope).toBe("recovery"); expect(await me(r)).toBeNull();
  expect((await post("/api/me/recovery-codes/initial", "", pair(redeemed, SESSION_COOKIE))).status).toBe(403);
  // Existing GitHub replacement must not become cross-provider linking/recovery.
  await expect(replaceGithubIdentity(sql, recovery!.accountId, { id: 43, login: "unlinked", avatarUrl: "" }, { tokenHash: recovery!.tokenHash, scope: "recovery" })).rejects.toMatchObject({ code: "nostr_lifecycle_pending" });
  expect((await sql`select provider from identities`)[0]!.provider).toBe("nostr");
});

it("uses the existing full-session expiration, hashed-token and logout rules", async () => {
  const r = await login(await challenge()); const s = (await me(r))!;
  const [row] = await sql`select *, extract(epoch from expires_at - created_at)::int as lifetime from sessions`;
  expect(row!.lifetime).toBe(30 * 86400); expect(row!.token_hash.length).toBe(32);
  await sql`update sessions set last_seen_at = now() - interval '15 days'`;
  expect(await me(r)).toBeNull();
  const fresh = await login(await challenge());
  expect((await post("/api/auth/logout", "", pair(fresh, SESSION_COOKIE))).status).toBe(204);
  expect(await me(fresh)).toBeNull();
  expect((await sql`select account_id from identities`)[0]!.account_id).toBe(s.accountId);
});

it("validates language, return path and strict challenge body; throttles source before writes", async () => {
  expect((await post("/api/auth/nostr/challenge", '{"lang":"fr"}')).status).toBe(400);
  expect((await post("/api/auth/nostr/challenge", '{"lang":"en","purpose":"link"}')).status).toBe(400);
  const c = await challenge({ returnTo: "https://evil.test" });
  expect((await sql`select return_to from auth_challenges where id = ${c.body.challengeId}`)[0]!.return_to).toBe("/sw/account/");
  const route = nostrRoutes(new Limiter([{ name: "test", key: perIp, limit: 0, windowMs: 60000 }]))[0]!;
  await expect(route.handler({ ip: "127.0.0.1", sql, body: { lang: "sw" } } as never)).rejects.toMatchObject({ status: 429 });
});

it("builds the exact HTTP URL from SITE_ORIGIN without weakening cookie security", async () => {
  const route = nostrRoutes()[0]!;
  const result = await route.handler({ sql, cfg: fakeConfig({ siteOrigin: "http://localhost:8080" }), ip: "127.0.0.2", body: { lang: "en" } } as never);
  expect((result.json as { url: string }).url).toBe("http://localhost:8080/api/auth/nostr/verify");
  expect(result.setCookies![0]).toContain("Secure");
});

it("remote challenges expire after two minutes, remain single-use, and retain independent proof verification", async () => {
  const c = await challenge({ remote: true });
  const [row] = await sql`select extract(epoch from expires_at - created_at)::int as lifetime from auth_challenges`;
  expect(row!.lifetime).toBe(120);
  expect(c.response.headers.get("set-cookie")).toContain("Max-Age=120");
  expect((await login(c)).status).toBe(200);
  expect((await login(c)).status).toBe(401);
  const expired = await challenge({ remote: true });
  await sql`update auth_challenges set expires_at = now() - interval '1 second' where id = ${expired.body.challengeId}`;
  expect((await login(expired)).status).toBe(401);
  expect(await count("accounts")).toBe(1);
});
