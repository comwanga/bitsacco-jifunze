import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Config } from "./config.ts";
import { logEvent } from "./accounts.ts";
import { accountAllowed } from "./allowlist.ts";
import { ApiError } from "./errors.ts";
import type { Route, Session, Sql } from "./http.ts";
import { Limiter, perIp, slash24 } from "./ratelimit.ts";
import { createSession, revokeOtherSessions } from "./sessions.ts";

/*
 * Single-use recovery codes. A code is 16 characters of base32 (80 bits), shown in
 * four groups of four. Only HMAC-SHA256(pepper, normalised code) is stored, with the
 * pepper version, so the pepper can be rotated without invalidating issued codes.
 * Plaintext is returned once by issueCodes and never stored or logged.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CODES_PER_SET = 10;
const CODE_LENGTH = 16;

function oneCode(): string {
  // 10 random bytes = 80 bits = 16 groups of 5 bits; each group maps straight onto a base32 character.
  let acc = 0;
  let bits = 0;
  let out = "";
  for (const byte of randomBytes(10)) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`;
}

export function generateCodes(): string[] {
  const set = new Set<string>();
  while (set.size < CODES_PER_SET) set.add(oneCode());
  return [...set];
}

export function normaliseCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 64) return null;
  const n = input.toUpperCase().replace(/[-\s]/g, "");
  if (n.length !== CODE_LENGTH) return null;
  for (const ch of n) if (!ALPHABET.includes(ch)) return null;
  return n;
}

export function hashCode(pepper: Buffer, normalised: string): Buffer {
  return createHmac("sha256", pepper).update(normalised).digest();
}

/**
 * Replaces the account's whole set in one transaction and returns the new plaintext codes.
 * With `initial`, it first claims the account's first set in that same transaction (409 if already claimed),
 * so a failure or a dead process before commit leaves the account unclaimed and able to try again.
 * With `session`, the requesting session is re-checked inside the transaction (401 if it is no longer live, 403
 * if a full session's re-auth is stale), so a replace or a redemption that revoked it first wins. Routes always
 * pass it.
 */
export async function issueCodes(
  sql: Sql,
  cfg: Config,
  accountId: string,
  opts: { initial?: boolean; session?: Pick<Session, "tokenHash" | "scope"> } = {},
): Promise<string[]> {
  const pepper = cfg.peppers.get(cfg.currentPepper);
  if (!pepper) throw new Error("current recovery pepper is not configured");
  const codes = generateCodes();
  const setId = randomUUID();
  await sql.begin(async (tx) => {
    // Serialise concurrent regenerations for one account so exactly one set survives, and wait for a replace
    // in progress. NO KEY: inserts that reference the account (a redemption's session and event) must not block.
    await tx`select id from accounts where id = ${accountId} for no key update`;
    if (opts.initial) {
      const claimed = await tx`
        update accounts set recovery_codes_issued_at = now()
        where id = ${accountId} and recovery_codes_issued_at is null returning 1`;
      if (claimed.length === 0) throw new ApiError(409, "codes_already_issued");
    }
    await tx`delete from recovery_codes where account_id = ${accountId}`;
    if (opts.session) {
      // After the delete, so locks come in the order a redemption takes them (codes, then sessions). A revocation
      // that committed first is seen here; one that comes later waits for this commit. A failure rolls back the
      // delete, so the existing codes stay.
      const [live] = await tx<{ fresh: boolean }[]>`
        select (scope = 'recovery' or reauth_at > now() - interval '10 minutes') as fresh from sessions
        where token_hash = ${opts.session.tokenHash} and account_id = ${accountId} and scope = ${opts.session.scope}
          and revoked_at is null and expires_at > now()
        for no key update`;
      if (!live) throw new ApiError(401, "unauthenticated");
      if (!opts.initial && !live.fresh) throw new ApiError(403, "reauth_required");
    }
    for (const c of codes) {
      await tx`
        insert into recovery_codes (code_hash, pepper_version, account_id, set_id)
        values (${hashCode(pepper, normaliseCode(c)!)}, ${cfg.currentPepper}, ${accountId}, ${setId})`;
    }
    await tx`update accounts set recovery_codes_issued_at = now()
      where id = ${accountId} and recovery_codes_issued_at is null`;
  });
  return codes;
}

/** Atomically marks the matching unused code as used (checked under every pepper version); returns its account. */
export async function consumeCode(sql: Sql, cfg: Config, normalised: string): Promise<string | null> {
  const hashes = [...cfg.peppers.values()].map((p) => hashCode(p, normalised));
  const rows = await sql<{ account_id: string }[]>`
    update recovery_codes set used_at = now()
    where code_hash = any(${sql.array(hashes, 17)}) and used_at is null
    returning account_id`;
  return rows[0]?.account_id ?? null;
}

const FLOOD_THRESHOLD = 300;
const HOUR_MS = 3_600_000;

/** Blocks only per source: 5 per 15 minutes per IP (/64 for IPv6), 20 per hour per /24 (/48 for IPv6). */
export const RECOVERY_RULES = [
  { name: "recovery-ip", key: perIp, limit: 5, windowMs: 900_000 },
  { name: "recovery-net", key: slash24, limit: 20, windowMs: HOUR_MS },
];

/**
 * One operator log line per hourly window: outcome counts only, never a code, IP or account.
 * Failed attempts are counted here instead of one security-event row each, which would let an
 * attacker turn guessing into unbounded database writes.
 */
export type RecoverySummary = {
  event: "recovery_attempts_hourly";
  windowStart: string;
  attempts: number;
  succeeded: number;
  invalid: number;
  rateLimited: number;
};
export type Outcome = "succeeded" | "invalid" | "rateLimited";

function logSummary(s: RecoverySummary): void {
  console.info(JSON.stringify(s));
}

/**
 * Counts every attempt in fixed hourly windows. The first attempt past the threshold in a window
 * is reported once as a flood. When a window ends, its counts go to `report` on the next attempt.
 * Never blocks; memory is constant.
 */
export class FloodWatch {
  private windowStart = 0;
  private windowEnd = 0;
  private count = 0;
  private reported = false;
  private outcomes: Record<Outcome, number> = { succeeded: 0, invalid: 0, rateLimited: 0 };
  private readonly now: () => number;
  private readonly report: (s: RecoverySummary) => void;
  constructor(now: () => number = Date.now, report: (s: RecoverySummary) => void = logSummary) {
    this.now = now;
    this.report = report;
  }
  /** Records how an attempt in the current window ended. */
  outcome(kind: Outcome): void {
    this.outcomes[kind] += 1;
  }
  /** Returns the count when this call should write the hourly alert, else null. */
  note(): number | null {
    const t = this.now();
    if (t >= this.windowEnd) {
      if (this.count > 0) {
        try {
          this.report({
            event: "recovery_attempts_hourly",
            windowStart: new Date(this.windowStart).toISOString(),
            attempts: this.count,
            ...this.outcomes,
          });
        } catch {
          // Monitoring must never turn into a failure for the caller.
        }
      }
      this.windowStart = t;
      this.windowEnd = t + HOUR_MS;
      this.count = 0;
      this.reported = false;
      this.outcomes = { succeeded: 0, invalid: 0, rateLimited: 0 };
    }
    this.count += 1;
    if (this.count > FLOOD_THRESHOLD && !this.reported) {
      this.reported = true;
      return this.count;
    }
    return null;
  }
}

export function recoveryRoutes(
  limiter: Limiter = new Limiter(RECOVERY_RULES),
  flood: FloodWatch = new FloodWatch(),
): Route[] {
  const redeem: Route = {
    method: "POST",
    path: "/api/auth/recovery",
    auth: "public",
    body: z.object({ code: z.string().max(256) }).strict(),
    handler: async ({ body, ip, sql, cfg }) => {
      // Limits first, before any normalisation or lookup. Only per-source limits ever block.
      const allowed = limiter.hit(ip);
      const flooded = flood.note(); // refused attempts count toward volume too
      if (flooded !== null) {
        try {
          await logEvent(sql, null, "recovery_flood", { count: String(flooded) });
        } catch {
          // The alert must never turn into a failure for the caller.
        }
      }

      if (!allowed) {
        flood.outcome("rateLimited");
        throw new ApiError(429, "rate_limited");
      }

      const invalid = () => {
        flood.outcome("invalid");
        return new ApiError(401, "recovery_invalid");
      };
      const normalised = normaliseCode((body as { code: string }).code);
      if (!normalised) throw invalid();

      // One transaction: if any step fails, the code is not spent and no session changes.
      // The code row stays locked until commit, so a concurrent use of it waits and then sees it used.
      const { cookie, lang } = await sql.begin(async (tx) => {
        const accountId = await consumeCode(tx, cfg, normalised);
        if (!accountId) throw invalid();
        // Answered as a wrong code. Throwing rolls back the transaction, so the code stays unspent.
        if (!(await accountAllowed(tx, cfg.testerAllowlist, accountId))) throw invalid();
        await revokeOtherSessions(tx, accountId);
        const { cookie } = await createSession(tx, accountId, "recovery");
        await logEvent(tx, accountId, "recovery_code_used");
        const [acct] = await tx<{ preferred_lang: string }[]>`
          select preferred_lang from accounts where id = ${accountId}`;
        return { cookie, lang: acct?.preferred_lang === "en" ? "en" : "sw" };
      });
      flood.outcome("succeeded");
      return { status: 200, json: { redirect: `/${lang}/account/recovery/` }, setCookies: [cookie] };
    },
  };

  const initial: Route = {
    method: "POST",
    path: "/api/me/recovery-codes/initial",
    auth: "full",
    // The claim commits with the codes, so two racing first calls cannot both be shown a set.
    handler: async ({ sql, cfg, session }) => ({
      status: 200,
      json: { codes: await issueCodes(sql, cfg, session!.accountId, { initial: true, session: session! }) },
    }),
  };

  const regenerate: Route = {
    method: "POST",
    path: "/api/me/recovery-codes",
    auth: "any",
    recoveryAllowed: true,
    // The session and, for a full session, its re-auth freshness are checked inside issueCodes's transaction.
    handler: async ({ sql, cfg, session }) => ({
      status: 200,
      json: { codes: await issueCodes(sql, cfg, session!.accountId, { session: session! }) },
    }),
  };

  return [redeem, initial, regenerate];
}
