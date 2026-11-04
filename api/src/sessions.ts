import { createHash, randomBytes } from "node:crypto";
import { SESSION_COOKIE, type Route, type Session, type Sql } from "./http.ts";

/*
 * Server-side sessions.
 *
 * The cookie value is base64url(32 random bytes). The database stores only
 * sha256 of the RAW token bytes (not of the cookie string), so a database
 * read never yields a usable cookie. Every time comes from the database's now().
 *
 * Lifetimes: full = 14 days idle (last_seen_at) and 30 days absolute (created_at,
 * expires_at = created_at + 30 days). Recovery = 15 minutes absolute.
 */

const COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Lax; Path=/";
export const clearSessionCookie = `${SESSION_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;

/** Window for /api/me notices: recovery-code-used events from the last 30 days. */
const NOTICE_WINDOW = "30 days";

function sha256(b: Buffer): Buffer {
  return createHash("sha256").update(b).digest();
}

/** Decodes a cookie value to the raw 32-byte token, or null if it is not exactly that. */
function decodeToken(cookieValue: string | undefined): Buffer | null {
  if (!cookieValue || cookieValue.length !== 43) return null;
  const raw = Buffer.from(cookieValue, "base64url");
  if (raw.length !== 32 || raw.toString("base64url") !== cookieValue) return null;
  return raw;
}

export async function createSession(
  sql: Sql,
  accountId: string,
  scope: Session["scope"],
): Promise<{ cookie: string; tokenHash: Buffer }> {
  const token = randomBytes(32);
  const tokenHash = sha256(token);
  const lifetime = scope === "recovery" ? "15 minutes" : "30 days";
  await sql`
    insert into sessions (token_hash, account_id, scope, created_at, last_seen_at, expires_at)
    values (${tokenHash}, ${accountId}, ${scope}, now(), now(), now() + ${lifetime}::interval)`;
  return {
    cookie: `${SESSION_COOKIE}=${token.toString("base64url")}; ${COOKIE_ATTRS}`,
    tokenHash,
  };
}

/** Returns the live session and bumps last_seen_at, or null (unknown, revoked, expired, idle, deleted account). */
export async function readSession(sql: Sql, cookieValue: string | undefined): Promise<Session | null> {
  const token = decodeToken(cookieValue);
  if (!token) return null;
  const rows = await sql<{ token_hash: Buffer; account_id: string; scope: Session["scope"]; reauth_at: Date }[]>`
    update sessions s set last_seen_at = now()
    from accounts a
    where s.token_hash = ${sha256(token)}
      and a.id = s.account_id and a.deleted_at is null
      and s.revoked_at is null
      and s.expires_at > now()
      and s.created_at > now() - interval '30 days'
      and (s.scope = 'recovery' or s.last_seen_at > now() - interval '14 days')
    returning s.token_hash, s.account_id, s.scope, s.reauth_at`;
  const row = rows[0];
  if (!row) return null;
  return { tokenHash: row.token_hash, accountId: row.account_id, scope: row.scope, reauthAt: row.reauth_at };
}

export async function revokeSession(sql: Sql, tokenHash: Buffer): Promise<void> {
  await sql`update sessions set revoked_at = now() where token_hash = ${tokenHash} and revoked_at is null`;
}

/** Revokes every live session of the account except `keep`; returns how many were revoked. */
export async function revokeOtherSessions(sql: Sql, accountId: string, keep?: Buffer): Promise<number> {
  const rows = keep
    ? await sql`update sessions set revoked_at = now()
        where account_id = ${accountId} and revoked_at is null and token_hash <> ${keep} returning 1`
    : await sql`update sessions set revoked_at = now()
        where account_id = ${accountId} and revoked_at is null returning 1`;
  return rows.length;
}

/** Sets reauth_at on this one session if it is still live; false means it was revoked or expired meanwhile. */
export async function markReauth(sql: Sql, tokenHash: Buffer): Promise<boolean> {
  const rows = await sql`update sessions set reauth_at = now()
    where token_hash = ${tokenHash} and revoked_at is null and expires_at > now() returning 1`;
  return rows.length === 1;
}

/**
 * Daily purge. Sessions: expired, idle past 14 days, older than 30 days, or revoked
 * more than a day ago. Challenges: past expires_at. Security events: older than 90 days.
 */
export async function purgeExpired(sql: Sql): Promise<{ sessions: number; challenges: number; events: number }> {
  const s = await sql`delete from sessions
    where expires_at < now()
       or created_at < now() - interval '30 days'
       or (scope = 'full' and last_seen_at < now() - interval '14 days')
       or revoked_at < now() - interval '1 day'
    returning 1`;
  const c = await sql`delete from auth_challenges where expires_at < now() returning 1`;
  const e = await sql`delete from security_events where at < now() - interval '90 days' returning 1`;
  return { sessions: s.length, challenges: c.length, events: e.length };
}

export const meRoute: Route = {
  method: "GET",
  path: "/api/me",
  auth: "any",
  recoveryAllowed: true,
  handler: async ({ sql, session }) => {
    const s = session!;
    const [acct] = await sql<{ id: string; preferred_lang: string; issued: Date | null }[]>`
      select id, preferred_lang, recovery_codes_issued_at as issued from accounts where id = ${s.accountId}`;
    const ids = await sql<{ provider: string; provider_uid: string; handle: string | null; avatar_url: string | null; linked_at: Date }[]>`
      select provider, provider_uid, handle, avatar_url, linked_at from identities
      where account_id = ${s.accountId} order by linked_at`;
    const ev = await sql<{ at: Date }[]>`
      select at from security_events
      where account_id = ${s.accountId} and event = 'recovery_code_used'
        and at > now() - ${NOTICE_WINDOW}::interval
      order by at desc`;
    return {
      status: 200,
      json: {
        scope: s.scope,
        account: { id: acct!.id, preferredLang: acct!.preferred_lang, recoveryCodesIssued: acct!.issued !== null },
        identities: ids.map((i) => ({
          provider: i.provider,
          ...(i.provider === "nostr" ? { pubkey: i.provider_uid } : {}),
          handle: i.handle,
          avatarUrl: i.avatar_url,
          linkedAt: i.linked_at,
        })),
        notices: ev.map((e) => ({ type: "recovery_code_used", at: e.at })),
      },
    };
  },
};

export const logoutRoute: Route = {
  method: "POST",
  path: "/api/auth/logout",
  auth: "any",
  recoveryAllowed: true,
  handler: async ({ sql, session }) => {
    await revokeSession(sql, session!.tokenHash);
    return { status: 204, setCookies: [clearSessionCookie] };
  },
};
