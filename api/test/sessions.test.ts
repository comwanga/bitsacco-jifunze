import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connect, migrate } from "../src/db.ts";
import { createServer, type Route } from "../src/http.ts";
import { routes } from "../src/routes.ts";
import {
  clearSessionCookie,
  createSession,
  markReauth,
  purgeExpired,
  readSession,
  revokeOtherSessions,
  revokeSession,
} from "../src/sessions.ts";
import { fakeConfig, ORIGIN, resetTestDb, testDatabaseUrl } from "./helpers.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const sql = connect(testDatabaseUrl());

beforeEach(async () => {
  await resetTestDb(sql);
  await migrate(sql, dir);
});
afterAll(async () => {
  await sql.end({ timeout: 5 });
});

async function newAccount(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`insert into accounts default values returning id`;
  return row!.id;
}

const valueOf = (cookie: string) => cookie.split(";")[0]!.split("=")[1]!;

async function withServer<T>(extra: Route[], fn: (base: string) => Promise<T>): Promise<T> {
  const server = createServer([...routes, ...extra], {
    cfg: fakeConfig(),
    sql,
    readSession,
    log: () => {},
    logError: () => {},
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe("sessions", () => {
  it("cookie flags are exactly __Host-jf_session; HttpOnly; Secure; SameSite=Lax; Path=/", async () => {
    const a = await newAccount();
    const { cookie } = await createSession(sql, a, "full");
    expect(cookie).toMatch(/^__Host-jf_session=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/$/);
    expect(clearSessionCookie).toBe("__Host-jf_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  });

  it("the stored row has sha256(token), not the token", async () => {
    const a = await newAccount();
    const { cookie, tokenHash } = await createSession(sql, a, "full");
    const token = Buffer.from(valueOf(cookie), "base64url");
    expect(token.length).toBe(32);
    const expected = createHash("sha256").update(token).digest();
    expect(tokenHash.equals(expected)).toBe(true);
    const rows = await sql<{ token_hash: Buffer }[]>`select token_hash from sessions`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash.equals(expected)).toBe(true);
    expect(rows[0]!.token_hash.equals(token)).toBe(false);
  });

  it("readSession returns the session, bumps last_seen_at, and rejects junk", async () => {
    const a = await newAccount();
    const { cookie, tokenHash } = await createSession(sql, a, "full");
    await sql`update sessions set last_seen_at = now() - interval '1 day'`;
    const s = await readSession(sql, valueOf(cookie));
    expect(s).toMatchObject({ accountId: a, scope: "full" });
    expect(s!.tokenHash.equals(tokenHash)).toBe(true);
    const [row] = await sql<{ fresh: boolean }[]>`select last_seen_at > now() - interval '1 minute' as fresh from sessions`;
    expect(row!.fresh).toBe(true);
    expect(await readSession(sql, undefined)).toBeNull();
    expect(await readSession(sql, "")).toBeNull();
    expect(await readSession(sql, "not-a-token")).toBeNull();
    expect(await readSession(sql, Buffer.alloc(32, 1).toString("base64url"))).toBeNull();
  });

  it("idle 14 days -> null", async () => {
    const a = await newAccount();
    const { cookie } = await createSession(sql, a, "full");
    await sql`update sessions set last_seen_at = now() - interval '14 days 1 minute'`;
    expect(await readSession(sql, valueOf(cookie))).toBeNull();
  });

  it("absolute 30 days -> null", async () => {
    const a = await newAccount();
    const { cookie } = await createSession(sql, a, "full");
    await sql`update sessions set created_at = now() - interval '30 days 1 minute'`;
    expect(await readSession(sql, valueOf(cookie))).toBeNull();
    const b = await createSession(sql, a, "full");
    await sql`update sessions set expires_at = now() - interval '1 second' where token_hash = ${b.tokenHash}`;
    expect(await readSession(sql, valueOf(b.cookie))).toBeNull();
  });

  it("recovery scope after 15 minutes -> null", async () => {
    const a = await newAccount();
    const { cookie, tokenHash } = await createSession(sql, a, "recovery");
    const [row] = await sql<{ mins: number }[]>`
      select extract(epoch from expires_at - created_at) / 60 as mins from sessions where token_hash = ${tokenHash}`;
    expect(Number(row!.mins)).toBe(15);
    expect(await readSession(sql, valueOf(cookie))).toMatchObject({ scope: "recovery" });
    await sql`update sessions set created_at = now() - interval '16 minutes', expires_at = now() - interval '1 minute'`;
    expect(await readSession(sql, valueOf(cookie))).toBeNull();
  });

  it("a full session expires_at is created_at + 30 days", async () => {
    const a = await newAccount();
    const { tokenHash } = await createSession(sql, a, "full");
    const [row] = await sql<{ d: number }[]>`
      select extract(epoch from expires_at - created_at) / 86400 as d from sessions where token_hash = ${tokenHash}`;
    expect(Number(row!.d)).toBe(30);
  });

  it("a session of a deleted account -> null", async () => {
    const a = await newAccount();
    const { cookie } = await createSession(sql, a, "full");
    await sql`update accounts set deleted_at = now()`;
    expect(await readSession(sql, valueOf(cookie))).toBeNull();
  });

  it("a revoked session -> 401 on /api/me", async () => {
    const a = await newAccount();
    const { cookie, tokenHash } = await createSession(sql, a, "full");
    await withServer([], async (base) => {
      expect((await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).status).toBe(200);
      await revokeSession(sql, tokenHash);
      const r = await fetch(`${base}/api/me`, { headers: { Cookie: cookie } });
      expect(r.status).toBe(401);
    });
  });

  it("logout clears the cookie and revokes the row", async () => {
    const a = await newAccount();
    const { cookie } = await createSession(sql, a, "full");
    await withServer([], async (base) => {
      const r = await fetch(`${base}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: ORIGIN, "X-Jifunze": "1" },
      });
      expect(r.status).toBe(204);
      expect(r.headers.getSetCookie()).toEqual([clearSessionCookie]);
    });
    const [row] = await sql<{ revoked: boolean }[]>`select revoked_at is not null as revoked from sessions`;
    expect(row!.revoked).toBe(true);
    expect(await readSession(sql, valueOf(cookie))).toBeNull();
  });

  it("a recovery session gets 403 recovery_scope on a route without recoveryAllowed", async () => {
    const a = await newAccount();
    const { cookie } = await createSession(sql, a, "recovery");
    const guarded: Route[] = [
      { method: "GET", path: "/api/guarded", auth: "full", handler: async () => ({ status: 200, json: {} }) },
      { method: "GET", path: "/api/guarded-any", auth: "any", handler: async () => ({ status: 200, json: {} }) },
    ];
    await withServer(guarded, async (base) => {
      for (const p of ["/api/guarded", "/api/guarded-any"]) {
        const r = await fetch(`${base}${p}`, { headers: { Cookie: cookie } });
        expect(r.status).toBe(403);
        expect(((await r.json()) as { error: { code: string } }).error.code).toBe("recovery_scope");
      }
      expect((await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).status).toBe(200);
    });
  });

  it("/api/me has the exact shape and never contains a token, cookie or code", async () => {
    const a = await newAccount();
    await sql`insert into identities (account_id, provider, provider_uid, handle, avatar_url)
      values (${a}, 'github', '42', 'octo', 'https://avatars.example/42')`;
    await sql`insert into security_events (account_id, event) values (${a}, 'recovery_code_used')`;
    await sql`insert into security_events (account_id, event, at) values (${a}, 'recovery_code_used', now() - interval '40 days')`;
    const { cookie } = await createSession(sql, a, "full");
    await withServer([], async (base) => {
      const r = await fetch(`${base}/api/me`, { headers: { Cookie: cookie } });
      expect(r.status).toBe(200);
      const text = await r.text();
      const body = JSON.parse(text);
      expect(Object.keys(body).sort()).toEqual(["account", "identities", "notices", "scope"]);
      expect(body.scope).toBe("full");
      expect(body.account).toEqual({ id: a, preferredLang: expect.any(String), recoveryCodesIssued: false });
      expect(body.identities).toEqual([
        { provider: "github", handle: "octo", avatarUrl: "https://avatars.example/42", linkedAt: expect.any(String) },
      ]);
      expect(body.notices).toEqual([{ type: "recovery_code_used", at: expect.any(String) }]);
      expect(text).not.toContain(valueOf(cookie));
      expect(text).not.toMatch(/token|cookie|secret|code_hash/i);
    });
  });

  it("revokeOtherSessions keeps one; markReauth updates reauth_at", async () => {
    const a = await newAccount();
    const s1 = await createSession(sql, a, "full");
    await createSession(sql, a, "full");
    await createSession(sql, a, "full");
    expect(await revokeOtherSessions(sql, a, s1.tokenHash)).toBe(2);
    expect(await revokeOtherSessions(sql, a, s1.tokenHash)).toBe(0);
    expect(await readSession(sql, valueOf(s1.cookie))).not.toBeNull();
    await sql`update sessions set reauth_at = now() - interval '1 hour'`;
    await markReauth(sql, s1.tokenHash);
    const s = await readSession(sql, valueOf(s1.cookie));
    expect(Date.now() - s!.reauthAt.getTime()).toBeLessThan(60_000);
    expect(await revokeOtherSessions(sql, a)).toBe(1);
  });

  it("purgeExpired removes expired sessions, challenges and security events older than 90 days, and keeps the rest", async () => {
    const a = await newAccount();
    const keep = await createSession(sql, a, "full");
    const expired = await createSession(sql, a, "full");
    const idle = await createSession(sql, a, "full");
    const revoked = await createSession(sql, a, "full");
    await sql`update sessions set expires_at = now() - interval '1 second' where token_hash = ${expired.tokenHash}`;
    await sql`update sessions set last_seen_at = now() - interval '15 days' where token_hash = ${idle.tokenHash}`;
    await sql`update sessions set revoked_at = now() - interval '2 days' where token_hash = ${revoked.tokenHash}`;
    const ch = (secret: number, expires: string) =>
      sql`insert into auth_challenges (purpose, provider, secret_hash, binding_hash, lang, return_to, expires_at)
        values ('signin', 'github', ${Buffer.alloc(32, secret)}, ${Buffer.alloc(32, 9)}, 'en', '/en/', now() + ${expires}::interval)`;
    await ch(1, "-1 minute");
    await ch(2, "5 minutes");
    await sql`insert into security_events (account_id, event, at) values (${a}, 'old', now() - interval '91 days')`;
    await sql`insert into security_events (account_id, event, at) values (${a}, 'recent', now() - interval '89 days')`;

    expect(await purgeExpired(sql)).toEqual({ sessions: 3, challenges: 1, events: 1 });

    const left = await sql<{ token_hash: Buffer }[]>`select token_hash from sessions`;
    expect(left).toHaveLength(1);
    expect(left[0]!.token_hash.equals(keep.tokenHash)).toBe(true);
    expect(await sql`select 1 from auth_challenges`).toHaveLength(1);
    const ev = await sql<{ event: string }[]>`select event from security_events`;
    expect(ev.map((e) => e.event)).toEqual(["recent"]);
  });
});
