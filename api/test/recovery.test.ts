import { spawn } from "node:child_process";
import { createServer as netServer, type AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { replaceGithubIdentity } from "../src/accounts.ts";
import type { Config } from "../src/config.ts";
import { connect, migrate } from "../src/db.ts";
import { githubRoutes, GITHUB_START_RULE } from "../src/github-routes.ts";
import { createServer, type Route } from "../src/http.ts";
import { clientIp } from "../src/http.ts";
import { Limiter, perIp, slash24 } from "../src/ratelimit.ts";
import {
  FloodWatch,
  generateCodes,
  hashCode,
  issueCodes,
  normaliseCode,
  RECOVERY_RULES,
  recoveryRoutes,
  type RecoverySummary,
} from "../src/recovery.ts";
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

async function withApi<T>(
  fn: (base: string) => Promise<T>,
  cfg: Config = cfgV1(),
  table: Route[] = [meRoute, ...recoveryRoutes()],
): Promise<T> {
  const server = createServer(table, { cfg, sql, readSession, log: () => {}, logError: () => {} });
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

  describe("the initial claim and its codes are one transaction", () => {
    const initial = (base: string, cookie: string) => post(base, "/api/me/recovery-codes/initial", undefined, { cookie });
    const state = async (a: string) => {
      const [acct] = await sql<{ issued: Date | null }[]>`select recovery_codes_issued_at as issued from accounts where id = ${a}`;
      const codes = await sql`select 1 from recovery_codes where account_id = ${a}`;
      return { claimed: acct!.issued !== null, codes: codes.length };
    };

    it("the API process killed after the claim, while the codes are being inserted, leaves the account unclaimed", async () => {
      const a = await newAccount();
      const cookie = pair((await createSession(sql, a, "full")).cookie);
      const port = await new Promise<number>((resolve) => {
        const probe = netServer().listen(0, "127.0.0.1", () => {
          const p = (probe.address() as AddressInfo).port;
          probe.close(() => resolve(p));
        });
      });
      const child = spawn(process.execPath, [join(dir, "..", "src", "main.ts")], {
        stdio: "ignore",
        env: {
          ...process.env,
          PORT: String(port),
          DATABASE_URL: testDatabaseUrl(),
          SITE_ORIGIN: ORIGIN,
          GITHUB_CLIENT_ID: "test-only",
          GITHUB_CLIENT_SECRET: "test-only",
          RECOVERY_PEPPER_V1: FAKE_V1.toString("base64"),
        },
      });
      const exited = new Promise<void>((r) => child.once("exit", () => r()));
      try {
        const base = `http://127.0.0.1:${port}`;
        for (let i = 0; ; i++) {
          if ((await fetch(`${base}/api/health`).catch(() => null))?.ok) break;
          if (i > 100) throw new Error("the API process did not start");
          await new Promise((r) => setTimeout(r, 100));
        }
        // Holds the first code insert open long enough to kill the process in the middle of it.
        await sql.unsafe(`
          create function slow_insert() returns trigger language plpgsql as $$ begin perform pg_sleep(30); return new; end $$;
          create trigger slow_codes before insert on recovery_codes for each row execute function slow_insert();`);
        const pending = initial(base, cookie).catch(() => null);
        const sleeping = async () =>
          (await sql`select pid from pg_stat_activity where wait_event = 'PgSleep' and pid <> pg_backend_pid()`).length;
        for (let i = 0; (await sleeping()) === 0; i++) {
          if (i > 100) throw new Error("the code insert never started");
          await new Promise((r) => setTimeout(r, 50));
        }
        child.kill("SIGKILL");
        await exited;
        await pending;
        // The dead process's backend would otherwise sleep on, holding its locks.
        await sql`select pg_terminate_backend(pid) from pg_stat_activity where wait_event = 'PgSleep' and pid <> pg_backend_pid()`;
        while ((await sleeping()) > 0) await new Promise((r) => setTimeout(r, 50));
        await sql.unsafe(`drop trigger slow_codes on recovery_codes`);

        expect(await state(a)).toEqual({ claimed: false, codes: 0 });
        await withApi(async (b) => {
          const r = await initial(b, cookie);
          expect(r.status).toBe(200);
          expect(((await r.json()) as { codes: string[] }).codes).toHaveLength(10);
        });
        expect(await state(a)).toEqual({ claimed: true, codes: 10 });
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      }
    }, 30_000);

    it("a failure inserting the codes, with no chance to undo the claim afterwards, leaves the account unclaimed", async () => {
      const a = await newAccount();
      const cookie = pair((await createSession(sql, a, "full")).cookie);
      // The insert fails, and any later statement that clears the claim fails too, as it would if the process died.
      await sql.unsafe(`
        create function fail_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$;
        create trigger fail_codes before insert on recovery_codes for each row execute function fail_insert();
        create function no_unclaim() returns trigger language plpgsql as $$
        begin
          if old.recovery_codes_issued_at is not null and new.recovery_codes_issued_at is null then raise exception 'unclaim blocked'; end if;
          return new;
        end $$;
        create trigger no_unclaim before update on accounts for each row execute function no_unclaim();`);
      await withApi(async (base) => {
        expect((await initial(base, cookie)).status).toBe(500);
        expect(await state(a)).toEqual({ claimed: false, codes: 0 });
        await sql.unsafe(`drop trigger fail_codes on recovery_codes`);
        const r = await initial(base, cookie);
        expect(r.status).toBe(200);
        expect(((await r.json()) as { codes: string[] }).codes).toHaveLength(10);
        expect(await state(a)).toEqual({ claimed: true, codes: 10 });
      });
    });

    it("two racing initial calls: one gets the codes, the other 409, and one set exists", async () => {
      const a = await newAccount();
      const cookie = pair((await createSession(sql, a, "full")).cookie);
      await withApi(async (base) => {
        const rs = await Promise.all([initial(base, cookie), initial(base, cookie)]);
        expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(await state(a)).toEqual({ claimed: true, codes: 10 });
      });
    });
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
      expect(await status(base, "2001:db8:1:1::ff")).toBe(429); // 6th in the /64: refused, so it does not count against the network
      for (let i = 2; i <= 16; i++) expect(await status(base, `2001:db8:1:${i}::1`)).toBe(401); // network count 20
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

describe("failed recovery attempts are counted in aggregate, not stored one by one", () => {
  it("one structured summary per hour with outcome counts only; no per-attempt security events", async () => {
    const a = await newAccount();
    const [code] = await issueCodes(sql, cfgV1(), a);
    let t = 1_000_000;
    const reports: RecoverySummary[] = [];
    const watch = new FloodWatch(() => t, (s) => reports.push(s));
    const table = [meRoute, ...recoveryRoutes(new Limiter(RECOVERY_RULES), watch)];
    await withApi(
      async (base) => {
        expect((await rec(base, code, "198.51.100.1")).status).toBe(200);
        for (let i = 0; i < 2; i++) expect((await rec(base, "ABCD-EFGH-IJKL-MNOP", "198.51.100.2")).status).toBe(401);
        for (let i = 0; i < 5; i++) expect((await rec(base, "not a code", "198.51.100.3")).status).toBe(401);
        expect((await rec(base, "ABCD-EFGH-IJKL-MNOP", "198.51.100.3")).status).toBe(429);
        expect(reports).toEqual([]); // nothing until the hour is over

        t += 3_600_000;
        expect((await rec(base, "ABCD-EFGH-IJKL-MNOP", "203.0.113.1")).status).toBe(401);
        expect(reports).toEqual([
          {
            event: "recovery_attempts_hourly",
            windowStart: new Date(1_000_000).toISOString(),
            attempts: 9,
            succeeded: 1,
            invalid: 7,
            rateLimited: 1,
          },
        ]);
        const out = JSON.stringify(reports);
        for (const secret of [code!, code!.replaceAll("-", ""), "198.51.100", "203.0.113"]) expect(out).not.toContain(secret);
        const events = await sql<{ event: string }[]>`select event from security_events`;
        expect(events.map((e) => e.event)).toEqual(["recovery_code_used"]);
      },
      cfgV1(),
      table,
    );
  });

  it("a summary sink that throws never fails the request", async () => {
    let t = 0;
    const watch = new FloodWatch(
      () => t,
      () => {
        throw new Error("sink down");
      },
    );
    await withApi(
      async (base) => {
        expect((await rec(base, "ABCD-EFGH-IJKL-MNOP", "198.51.100.2")).status).toBe(401);
        t += 3_600_000;
        expect((await rec(base, "ABCD-EFGH-IJKL-MNOP", "198.51.100.2")).status).toBe(401);
      },
      cfgV1(),
      [meRoute, ...recoveryRoutes(new Limiter(RECOVERY_RULES), watch)],
    );
  });
});

describe("refused requests and shared limits", () => {
  const status = async (base: string, ip: string) => (await rec(base, "ABCD-EFGH-IJKL-MNOP", ip)).status;

  it("a blocked IP does not drain its /24: a neighbour still gets 401, not 429", async () => {
    await withApi(async (base) => {
      for (let i = 0; i < 25; i++) await status(base, "198.51.100.7");
      expect(await status(base, "198.51.100.8")).toBe(401);
    });
  });

  it("the same holds for IPv6 within one /48", async () => {
    await withApi(async (base) => {
      for (let i = 0; i < 25; i++) await status(base, "2001:db8:1:1::7");
      expect(await status(base, "2001:db8:1:2::8")).toBe(401);
    });
  });

  it("a refused request still counts toward flood volume", async () => {
    await withApi(async (base) => {
      for (let i = 0; i < 310; i++) await status(base, "198.51.100.7");
      expect(await sql`select 1 from security_events where event = 'recovery_flood'`).toHaveLength(1);
    });
  }, 60_000);
});

describe("concurrent regeneration", () => {
  it("two concurrent issueCodes leave exactly one live set, and only its codes work", async () => {
    const a = await newAccount();
    const [x, y] = await Promise.all([issueCodes(sql, cfgV1(), a), issueCodes(sql, cfgV1(), a)]);
    const rows = await sql`select distinct set_id from recovery_codes where account_id = ${a}`;
    expect(rows).toHaveLength(1);
    expect(await sql`select 1 from recovery_codes where account_id = ${a} and used_at is null`).toHaveLength(10);
    // Exactly one of the two returned sets matches what is stored.
    const live = await sql<{ code_hash: Buffer }[]>`select code_hash from recovery_codes where account_id = ${a}`;
    const hashes = new Set(live.map((r) => r.code_hash.toString("hex")));
    const matches = (set: string[]) => set.filter((c) => hashes.has(hashCode(FAKE_V1, normaliseCode(c)!).toString("hex"))).length;
    expect([matches(x), matches(y)].sort()).toEqual([0, 10]);
  });
});

describe("canonical client IPs", () => {
  it("mapped IPv4 spellings share keys with plain IPv4", () => {
    for (const f of [perIp, slash24]) {
      expect(f("::FFFF:1.2.3.4")).toBe(f("1.2.3.4"));
      expect(f("0:0:0:0:0:ffff:1.2.3.4")).toBe(f("1.2.3.4"));
      expect(f("::ffff:102:304")).toBe(f("1.2.3.4"));
    }
    expect(perIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(perIp("::ffff:1.2.3.4")).not.toBe(perIp("::ffff:1.2.3.5"));
    expect(slash24("::FFFF:1.2.3.4")).toBe("1.2.3.0/24");
  });

  it("embedded-IPv4 IPv6 gets the right /64 and /48; casing does not matter", () => {
    expect(perIp("1::2:3:4:5:1.2.3.4")).toBe("1:0:2:3::/64");
    expect(slash24("1::2:3:4:5:1.2.3.4")).toBe("1:0:2::/48");
    expect(perIp("2001:DB8:1:2::9")).toBe(perIp("2001:db8:1:2::9"));
    expect(slash24("2001:DB8:1:2::9")).toBe(slash24("2001:db8:1:2::9"));
    expect(perIp("64:ff9b::1.2.3.4")).toBe("64:ff9b:0:0::/64");
  });

  it("clientIp normalises the chosen address", () => {
    expect(clientIp("127.0.0.1", "::FFFF:1.2.3.4")).toBe("1.2.3.4");
    expect(clientIp("127.0.0.1", "0:0:0:0:0:ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(clientIp("127.0.0.1", "2001:DB8::1")).toBe("2001:db8::1");
    expect(clientIp("::ffff:198.51.100.7", undefined)).toBe("198.51.100.7");
  });
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

  describe("redemption is one transaction", () => {
    // Each failure is injected after the code row has already been marked used inside the request.
    it.each([
      ["creating the recovery session", "sessions"],
      ["recording the security event", "security_events"],
    ])("a failure %s rolls back: 500, the code stays usable, other sessions stay live", async (_, table) => {
      const a = await newAccount("en");
      const [code] = await issueCodes(sql, cfgV1(), a);
      const full = pair((await createSession(sql, a, "full")).cookie);
      await sql.unsafe(`
        create function fail_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$;
        create trigger fail_redeem before insert on ${table} for each row execute function fail_insert();`);
      await withApi(async (base) => {
        const failed = await rec(base, code, "198.51.100.1");
        expect(failed.status).toBe(500);
        expect(await errCode(failed)).toBe("internal");
        expect(failed.headers.getSetCookie()).toEqual([]);
        expect(await sql`select 1 from recovery_codes where account_id = ${a} and used_at is not null`).toHaveLength(0);
        expect(await sql`select 1 from sessions where account_id = ${a} and scope = 'recovery'`).toHaveLength(0);
        expect(await sql`select 1 from security_events where event = 'recovery_code_used'`).toHaveLength(0);
        expect(await readSession(sql, full.split("=")[1])).not.toBeNull();

        await sql.unsafe(`drop trigger fail_redeem on ${table}`);
        const ok = await rec(base, code, "198.51.100.2");
        expect(ok.status).toBe(200);
        expect(await readSession(sql, full.split("=")[1])).toBeNull();
        expect(await sql`select 1 from security_events where event = 'recovery_code_used'`).toHaveLength(1);
      });
    });

    it("20 concurrent uses while the first attempt fails → still at most one success, and the code is not lost", async () => {
      const a = await newAccount();
      const [code] = await issueCodes(sql, cfgV1(), a);
      // Fails only the first recovery-session insert; later ones go through. A sequence, unlike a
      // table row, is not rolled back with the failing transaction.
      await sql.unsafe(`
        create sequence fail_seq;
        create function fail_first() returns trigger language plpgsql as $$
        begin
          if nextval('fail_seq') = 1 then raise exception 'injected failure'; end if;
          return new;
        end $$;
        create trigger fail_redeem before insert on sessions for each row execute function fail_first();`);
      await withApi(async (base) => {
        const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => rec(base, code, `198.51.${100 + i}.9`)));
        const statuses = rs.map((r) => r.status);
        expect(statuses.filter((s) => s === 200)).toHaveLength(1);
        expect(statuses.filter((s) => s === 500)).toHaveLength(1);
        expect(statuses.filter((s) => s === 401)).toHaveLength(18);
        expect(await sql`select 1 from sessions where account_id = ${a} and scope = 'recovery'`).toHaveLength(1);
        expect(await sql`select 1 from security_events where event = 'recovery_code_used'`).toHaveLength(1);
      });
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

describe("issuance re-checks the requesting session inside its transaction", () => {
  // A trigger holds the other transaction at a known point until the test opens the gate. It waits in a loop,
  // not on a lock, so the replace's lock_timeout does not apply; the test observes each side's state in
  // pg_stat_activity instead of sleeping.
  const gate = (table: string, event: "insert" | "update") =>
    sql.unsafe(`
      create table gate (open boolean not null); insert into gate values (false);
      create function hold() returns trigger language plpgsql as $$
      begin while not (select open from gate) loop perform pg_sleep(0.01); end loop; return new; end $$;
      create trigger hold after ${event} on ${table} for each row execute function hold();`);
  const openGate = () => sql`update gate set open = true`;
  const until = async (what: string, check: () => Promise<boolean>) => {
    for (let i = 0; !(await check()); i++) {
      if (i > 400) throw new Error(`timed out waiting for ${what}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  };
  const held = async () => (await sql`select 1 from pg_stat_activity where wait_event = 'PgSleep'`).length > 0;
  const waitingOnLock = async () =>
    (await sql`select 1 from pg_stat_activity where wait_event_type = 'Lock' and pid <> pg_backend_pid()`).length > 0;
  const codeHashes = async (a: string) =>
    (await sql<{ h: string }[]>`select encode(code_hash, 'hex') as h from recovery_codes where account_id = ${a} order by 1`).map(
      (r) => r.h,
    );
  const linked = async (a: string, uid: string) =>
    sql`insert into identities (account_id, provider, provider_uid, handle) values (${a}, 'github', ${uid}, 'octo')`;

  it("a regeneration waiting behind a replace that revokes its session → 401 unauthenticated, and the existing codes stay", async () => {
    const a = await newAccount();
    await linked(a, "1001");
    await issueCodes(sql, cfgV1(), a);
    const before = await codeHashes(a);
    const rec = await createSession(sql, a, "recovery"); // starts the replace
    const full = await createSession(sql, a, "full"); // regenerates; fresh, as reauth_at starts at creation
    await gate("identities", "insert"); // the replace holds the account lock and has not yet revoked anything
    await withApi(async (base) => {
      const replace = replaceGithubIdentity(sql, a, { id: 2002, login: "hubot", avatarUrl: "" }, { tokenHash: rec.tokenHash, scope: "recovery" });
      await until("the replace to reach the gate", held);
      const regen = post(base, "/api/me/recovery-codes", undefined, { cookie: pair(full.cookie) });
      await until("the regeneration to wait for the account lock", waitingOnLock);
      await openGate(); // the replace revokes every session, including the regenerating one, and commits
      expect((await replace).outcome).toBe("replaced");
      const r = await regen;
      expect(r.status).toBe(401);
      expect(await errCode(r)).toBe("unauthenticated");
      expect(await codeHashes(a)).toEqual(before);
    });
  });

  it("the first set requested behind a replace that revokes the session → 401, and the account stays unclaimed", async () => {
    const a = await newAccount();
    await linked(a, "1001");
    const starter = await createSession(sql, a, "full"); // a fresh full session may replace
    const asker = await createSession(sql, a, "full"); // asks for the first set
    await gate("identities", "insert");
    await withApi(async (base) => {
      const replace = replaceGithubIdentity(sql, a, { id: 2002, login: "hubot", avatarUrl: "" }, { tokenHash: starter.tokenHash, scope: "full" });
      await until("the replace to reach the gate", held);
      const first = post(base, "/api/me/recovery-codes/initial", undefined, { cookie: pair(asker.cookie) });
      await until("the first-set request to wait for the account lock", waitingOnLock);
      await openGate();
      expect((await replace).outcome).toBe("replaced");
      const r = await first;
      expect(r.status).toBe(401);
      expect(await errCode(r)).toBe("unauthenticated");
      const [acct] = await sql`select recovery_codes_issued_at from accounts where id = ${a}`;
      expect(acct!.recovery_codes_issued_at).toBeNull();
      expect(await codeHashes(a)).toEqual([]);
    });
  });

  it.each([
    ["its re-auth goes stale", "reauth_at = now() - interval '11 minutes'", 403, "reauth_required"],
    ["it expires", "expires_at = now() - interval '1 second'", 401, "unauthenticated"],
  ])("a regeneration whose session %s while it waits for the account lock → refused, and the existing codes stay", async (_, change, status, code) => {
    const a = await newAccount();
    await issueCodes(sql, cfgV1(), a);
    const before = await codeHashes(a);
    const full = await createSession(sql, a, "full");
    const holder = await sql.reserve();
    try {
      await holder`begin`;
      await holder`select id from accounts where id = ${a} for no key update`;
      await withApi(async (base) => {
        const regen = post(base, "/api/me/recovery-codes", undefined, { cookie: pair(full.cookie) });
        await until("the regeneration to wait for the account lock", waitingOnLock);
        await sql.unsafe(`update sessions set ${change} where token_hash = $1`, [full.tokenHash]);
        await holder`commit`;
        const r = await regen;
        expect(r.status).toBe(status);
        expect(await errCode(r)).toBe(code);
        expect(await codeHashes(a)).toEqual(before);
      });
    } finally {
      holder.release();
    }
  });

  it("a regeneration waiting behind a recovery-code redemption that revokes its session → 401, and the existing codes stay", async () => {
    const a = await newAccount();
    const [code] = await issueCodes(sql, cfgV1(), a);
    const before = await codeHashes(a);
    const full = await createSession(sql, a, "full");
    await gate("recovery_codes", "update"); // the redemption has consumed the code and not yet revoked anything
    await withApi(async (base) => {
      const redeem = rec(base, code, "198.51.100.1");
      await until("the redemption to reach the gate", held);
      const regen = post(base, "/api/me/recovery-codes", undefined, { cookie: pair(full.cookie) });
      await until("the regeneration to wait on the consumed code", waitingOnLock);
      await openGate(); // the redemption revokes every other session and commits
      expect((await redeem).status).toBe(200);
      const r = await regen;
      expect(r.status).toBe(401);
      expect(await errCode(r)).toBe("unauthenticated");
      expect(await codeHashes(a)).toEqual(before); // the same set; only the redeemed code is now used
      expect(await sql`select 1 from recovery_codes where account_id = ${a} and used_at is not null`).toHaveLength(1);
    });
  });
});
