import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../src/config.ts";
import { connect, migrate } from "../src/db.ts";
import { githubRoutes, GITHUB_START_RULE } from "../src/github-routes.ts";
import { createServer } from "../src/http.ts";
import { Limiter, perIp, slash24 } from "../src/ratelimit.ts";
import { generateCodes, hashCode, issueCodes, normaliseCode, recoveryRoutes } from "../src/recovery.ts";
import { createSession, meRoute, readSession } from "../src/sessions.ts";
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

const FAKE_V1 = Buffer.alloc(32, 0x11);
const FAKE_V2 = Buffer.alloc(32, 0x22);
const ALPHABET = /^[A-Z2-7]{4}(-[A-Z2-7]{4}){3}$/;
const cfgV1 = () => fakeConfig({ peppers: new Map([[1, FAKE_V1]]), currentPepper: 1 });

async function newAccount(lang: "sw" | "en" = "sw"): Promise<string> {
  const [row] = await sql<{ id: string }[]>`insert into accounts (preferred_lang) values (${lang}) returning id`;
  return row!.id;
}

async function withApi<T>(fn: (base: string) => Promise<T>, cfg: Config = cfgV1()): Promise<T> {
  const server = createServer([meRoute, ...recoveryRoutes()], { cfg, sql, readSession, log: () => {}, logError: () => {} });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}

function post(base: string, path: string, body: unknown, opts: { ip?: string; cookie?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { origin: ORIGIN, "x-jifunze": "1" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (opts.ip) headers["x-real-ip"] = opts.ip;
  if (opts.cookie) headers.cookie = opts.cookie;
  return fetch(base + path, { method: "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const rec = (base: string, code: unknown, ip?: string, cookie?: string) =>
  post(base, "/api/auth/recovery", { code }, { ip, cookie });
const cookieOf = (r: Response) => r.headers.getSetCookie()[0]!.split(";")[0]!;
const pair = (cookie: string) => cookie.split(";")[0]!;
const errCode = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;

describe("recovery codes", () => {
  it("generateCodes gives 10 distinct codes in groups of four from the base32 alphabet", () => {
    const codes = generateCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(ALPHABET);
      expect(normaliseCode(c)).toBe(c.replaceAll("-", ""));
    }
    expect(normaliseCode(" abcd-efgh ijkl-mnop ")).toBe("ABCDEFGHIJKLMNOP");
    expect(normaliseCode("ABCD-EFGH-IJKL-MNO1")).toBeNull();
    expect(normaliseCode("ABCD")).toBeNull();
    expect(normaliseCode(42)).toBeNull();
    expect(hashCode(FAKE_V1, "ABCDEFGHIJKLMNOP")).toHaveLength(32);
  });

  it("the database stores no plaintext code", async () => {
    const a = await newAccount();
    const codes = await issueCodes(sql, cfgV1(), a);
    const dump = JSON.stringify(await sql`select * from recovery_codes`);
    for (const c of codes) {
      expect(dump).not.toContain(c);
      expect(dump).not.toContain(c.replaceAll("-", ""));
    }
    expect(await sql`select 1 from recovery_codes where account_id = ${a} and used_at is null`).toHaveLength(10);
  });

  it("initial codes come back once; the second call → 409", async () => {
    const a = await newAccount();
    const cookie = pair((await createSession(sql, a, "full")).cookie);
    await withApi(async (base) => {
      const r1 = await post(base, "/api/me/recovery-codes/initial", undefined, { cookie });
      expect(r1.status).toBe(200);
      const { codes } = (await r1.json()) as { codes: string[] };
      expect(codes).toHaveLength(10);
      const r2 = await post(base, "/api/me/recovery-codes/initial", undefined, { cookie });
      expect(r2.status).toBe(409);
      expect(await errCode(r2)).toBe("codes_already_issued");
      const [acct] = await sql`select recovery_codes_issued_at from accounts where id = ${a}`;
      expect(acct!.recovery_codes_issued_at).not.toBeNull();
    });
  });

  it("a code works once; the second use → 401 recovery_invalid", async () => {
    const a = await newAccount("en");
    const [code] = await issueCodes(sql, cfgV1(), a);
    await withApi(async (base) => {
      const ok = await rec(base, code, "198.51.100.1");
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ redirect: "/en/account/recovery/" });
      expect(ok.headers.getSetCookie()[0]).toMatch(
        /^__Host-jf_session=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/$/,
      );
      const again = await rec(base, code, "198.51.101.2");
      expect(again.status).toBe(401);
      expect(await errCode(again)).toBe("recovery_invalid");
    });
  });

  it("20 concurrent uses of one code → exactly one 200", async () => {
    const a = await newAccount();
    const [code] = await issueCodes(sql, cfgV1(), a);
    await withApi(async (base) => {
      const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => rec(base, code, `198.51.${100 + i}.9`)));
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      expect(rs.filter((r) => r.status === 401)).toHaveLength(19);
      expect(await sql`select 1 from sessions where account_id = ${a} and scope = 'recovery'`).toHaveLength(1);
    });
  });

  it("regenerating invalidates every old code", async () => {
    const a = await newAccount();
    const old = await issueCodes(sql, cfgV1(), a);
    const fresh = await issueCodes(sql, cfgV1(), a);
    expect(await sql`select 1 from recovery_codes where account_id = ${a}`).toHaveLength(10);
    await withApi(async (base) => {
      for (const [i, c] of old.entries()) expect((await rec(base, c, `192.0.${i}.1`)).status).toBe(401);
      expect((await rec(base, fresh[0], "203.0.113.1")).status).toBe(200);
    });
  });

  it("unknown, used, malformed and empty input all give an identical 401 body", async () => {
    const a = await newAccount();
    const [code, other] = await issueCodes(sql, cfgV1(), a);
    await withApi(async (base) => {
      expect((await rec(base, code, "198.51.100.1")).status).toBe(200);
      const inputs = [code, "ABCD-EFGH-IJKL-MNOP", "not a code", "", "   ", other!.slice(0, 10), "x".repeat(100)];
      const bodies = new Set<string>();
      for (const [i, c] of inputs.entries()) {
        const r = await rec(base, c, `198.51.${101 + i}.1`);
        expect(r.status).toBe(401);
        bodies.add(await r.text());
      }
      expect(bodies.size).toBe(1);
      expect([...bodies][0]).toContain("recovery_invalid");
    });
  });

  it("the body accepts no handle or account id", async () => {
    const a = await newAccount();
    await withApi(async (base) => {
      const bodies = [
        { code: "ABCD-EFGH-IJKL-MNOP", handle: "x" },
        { code: "ABCD-EFGH-IJKL-MNOP", accountId: a },
        {},
        { code: 5 },
        { code: "A".repeat(500) },
      ];
      for (const body of bodies) {
        const r = await post(base, "/api/auth/recovery", body, { ip: "198.51.100.1" });
        expect(r.status).toBe(400);
        const text = await r.text();
        expect(text).toContain("bad_request");
        expect(text).not.toMatch(/handle|account/i);
      }
    });
  });
});

describe("recovery limits", () => {
  const status = async (base: string, ip: string) => (await rec(base, "ABCD-EFGH-IJKL-MNOP", ip)).status;
  const floodIp = (i: number) => `${11 + (i >> 8)}.${i & 255}.7.1`;

  it("the 6th attempt from one IP in 15 minutes → 429", async () => {
    await withApi(async (base) => {
      for (let i = 0; i < 5; i++) expect(await status(base, "198.51.100.7")).toBe(401);
      const r = await rec(base, "ABCD-EFGH-IJKL-MNOP", "198.51.100.7");
      expect(r.status).toBe(429);
      expect(await errCode(r)).toBe("rate_limited");
    });
  });

  it("the 21st from one /24 in an hour → 429", async () => {
    await withApi(async (base) => {
      for (let i = 1; i <= 20; i++) expect(await status(base, `198.51.100.${i}`)).toBe(401);
      expect(await status(base, "198.51.100.21")).toBe(429);
    });
  });

  it("an attacker exhausting IP A's limit does not affect IP B", async () => {
    await withApi(async (base) => {
      for (let i = 0; i < 5; i++) await status(base, "198.51.100.7");
      expect(await status(base, "198.51.100.7")).toBe(429);
      expect(await status(base, "203.0.113.9")).toBe(401);
    });
  });

  it("an attacker exhausting /24 X does not affect /24 Y", async () => {
    await withApi(async (base) => {
      for (let i = 1; i <= 20; i++) await status(base, `198.51.100.${i}`);
      expect(await status(base, "198.51.100.99")).toBe(429);
      expect(await status(base, "198.51.101.1")).toBe(401);
    });
  });

  it("IPv6 addresses in one /64 share a limit, and different /64s in one /48 share only the network limit", async () => {
    await withApi(async (base) => {
      for (let i = 0; i < 5; i++) expect(await status(base, `2001:db8:1:1::${i + 1}`)).toBe(401);
      expect(await status(base, "2001:db8:1:1::ff")).toBe(429); // 6th in the /64; network count 6
      for (let i = 2; i <= 15; i++) expect(await status(base, `2001:db8:1:${i}::1`)).toBe(401); // network count 20
      expect(await status(base, "2001:db8:1:99::1")).toBe(429); // 21st in the /48
      expect(await status(base, "2001:db8:2:1::1")).toBe(401); // another /48
    });
  });

  it("400 attempts in an hour from 400 distinct /24s are all evaluated (none gets 429 for global volume), and exactly one recovery_flood event is written for that hour", async () => {
    await withApi(async (base) => {
      const seen = new Set<number>();
      for (let i = 0; i < 400; i++) seen.add(await status(base, floodIp(i)));
      expect([...seen]).toEqual([401]);
      const ev = await sql<{ detail: Record<string, string> }[]>`select detail from security_events where event = 'recovery_flood'`;
      expect(ev).toHaveLength(1);
      expect(Object.keys(ev[0]!.detail)).toEqual(["count"]);
    });
  }, 60_000);

  it("a legitimate code from a fresh IP succeeds during such a flood", async () => {
    const a = await newAccount();
    const [code] = await issueCodes(sql, cfgV1(), a);
    await withApi(async (base) => {
      for (let i = 0; i < 320; i++) await status(base, floodIp(i));
      expect((await rec(base, code, "100.64.9.9")).status).toBe(200);
    });
  }, 60_000);
});

describe("recovery sessions", () => {
  it("a recovery session revokes the account's other sessions", async () => {
    const a = await newAccount();
    const [code] = await issueCodes(sql, cfgV1(), a);
    const full = pair((await createSession(sql, a, "full")).cookie);
    const bystander = await newAccount();
    const other = pair((await createSession(sql, bystander, "full")).cookie);
    await withApi(async (base) => {
      const r = await rec(base, code, "198.51.100.1", full);
      expect(r.status).toBe(200);
      const rc = cookieOf(r);
      const me = (c: string) => fetch(`${base}/api/me`, { headers: { cookie: c } });
      expect((await me(full)).status).toBe(401);
      expect((await me(rc)).status).toBe(200);
      expect((await me(other)).status).toBe(200);
      expect(await sql`select 1 from sessions where account_id = ${a} and revoked_at is null`).toHaveLength(1);
    });
  });

  it("a recovery session expires at 15 minutes", async () => {
    const a = await newAccount();
    const [code] = await issueCodes(sql, cfgV1(), a);
    await withApi(async (base) => {
      const rc = cookieOf(await rec(base, code, "198.51.100.1"));
      const [s] = await sql<{ secs: number }[]>`
        select extract(epoch from expires_at - created_at)::int as secs from sessions where scope = 'recovery'`;
      expect(s!.secs).toBe(900);
      await sql`update sessions set expires_at = now() - interval '1 second' where scope = 'recovery'`;
      expect((await fetch(`${base}/api/me`, { headers: { cookie: rc } })).status).toBe(401);
    });
  });

  it("/api/me shows a recovery_code_used notice afterwards", async () => {
    const a = await newAccount();
    const [code] = await issueCodes(sql, cfgV1(), a);
    await withApi(async (base) => {
      const rc = cookieOf(await rec(base, code, "198.51.100.1"));
      const j = (await (await fetch(`${base}/api/me`, { headers: { cookie: rc } })).json()) as {
        scope: string;
        notices: { type: string }[];
      };
      expect(j.scope).toBe("recovery");
      expect(j.notices.map((n) => n.type)).toEqual(["recovery_code_used"]);
    });
  });

  it("security_events contain no code", async () => {
    const a = await newAccount();
    const codes = await issueCodes(sql, cfgV1(), a);
    await withApi(async (base) => {
      expect((await rec(base, codes[0], "198.51.100.1")).status).toBe(200);
      const dump = JSON.stringify(await sql`select * from security_events`);
      expect(dump).toContain("recovery_code_used");
      for (const c of codes) {
        expect(dump).not.toContain(c);
        expect(dump).not.toContain(c.replaceAll("-", ""));
      }
    });
  });

  it("a code hashed with pepper v1 still works after v2 becomes current", async () => {
    const a = await newAccount();
    const [code] = await issueCodes(sql, cfgV1(), a);
    const v2 = fakeConfig({
      peppers: new Map([
        [1, FAKE_V1],
        [2, FAKE_V2],
      ]),
      currentPepper: 2,
    });
    await withApi(async (base) => {
      expect((await rec(base, code, "198.51.100.1")).status).toBe(200);
    }, v2);
    await issueCodes(sql, v2, a);
    const [row] = await sql`select pepper_version from recovery_codes where account_id = ${a} limit 1`;
    expect(row!.pepper_version).toBe(2);
  });
});

describe("regeneration route", () => {
  it("needs a recent re-auth for a full session; a recovery session is allowed; initial is not", async () => {
    const a = await newAccount();
    const fresh = await createSession(sql, a, "full");
    const stale = await createSession(sql, a, "full");
    await sql`update sessions set reauth_at = now() - interval '11 minutes' where token_hash = ${stale.tokenHash}`;
    await withApi(async (base) => {
      const denied = await post(base, "/api/me/recovery-codes", undefined, { cookie: pair(stale.cookie) });
      expect(denied.status).toBe(403);
      expect(await errCode(denied)).toBe("reauth_required");
      const ok = await post(base, "/api/me/recovery-codes", undefined, { cookie: pair(fresh.cookie) });
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as { codes: string[] }).codes).toHaveLength(10);
      const rs = pair((await createSession(sql, a, "recovery")).cookie);
      expect((await post(base, "/api/me/recovery-codes/initial", undefined, { cookie: rs })).status).toBe(403);
      expect((await post(base, "/api/me/recovery-codes", undefined, { cookie: rs })).status).toBe(200);
    });
  });
});

describe("ratelimit helpers", () => {
  it("perIp keeps IPv4 as-is (normalising mapped addresses) and takes the /64 of IPv6", () => {
    expect(perIp("203.0.113.77")).toBe("203.0.113.77");
    expect(perIp("::ffff:203.0.113.77")).toBe("203.0.113.77");
    expect(perIp("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    expect(perIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(perIp("2001:DB8:1:2::9")).toBe(perIp("2001:db8:1:2:ffff::1"));
  });

  it("many live buckets do not trigger a sweep on every hit", () => {
    let t = 1_000_000;
    const lim = new Limiter([{ name: "r", key: (ip) => ip, limit: 5, windowMs: 3_600_000 }], () => t);
    for (let i = 0; i < 10_050; i++) lim.hit(`ip-${i}`);
    const before = lim.sweeps;
    for (let i = 0; i < 2_000; i++) lim.hit(`ip-${i}`);
    expect(lim.sweeps - before).toBe(0);
    t += 61_000;
    const mid = lim.sweeps;
    for (let i = 0; i < 100; i++) lim.hit(`ip-${i}`);
    expect(lim.sweeps - mid).toBe(1);
    t += 3_600_000;
    lim.hit("fresh");
    t += 61_000;
    lim.hit("fresh2");
    expect(lim.size).toBeLessThan(10);
  });

  it("the default GitHub start limiter uses exactly GITHUB_START_RULE", async () => {
    expect(GITHUB_START_RULE).toEqual({ name: "github-start-ip", key: perIp, limit: 30, windowMs: 600_000 });
    const server = createServer(githubRoutes(), { cfg: cfgV1(), sql, readSession, log: () => {}, logError: () => {} });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const start = async (ip: string) => {
        const r = await fetch(`${base}/api/auth/github/start?purpose=signin&lang=en`, {
          redirect: "manual",
          headers: { "x-real-ip": ip },
        });
        return r.headers.get("location") ?? "";
      };
      for (let i = 1; i <= 30; i++) expect(await start(`2001:db8:5:5::${i}`)).toContain("/login/oauth/authorize");
      expect(await start("2001:db8:5:5::ffff")).toBe("/en/account/signin/?error=rate_limited");
      expect(await start("2001:db8:5:6::1")).toContain("/login/oauth/authorize");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("slash24 still groups as before", () => {
    expect(slash24("203.0.113.77")).toBe("203.0.113.0/24");
  });
});
