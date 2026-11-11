import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "./http.ts";

type Lang = "sw" | "en";
type Purpose = "signin" | "reauth" | "replace";

const sha256 = (s: string): Buffer => createHash("sha256").update(s).digest();
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** `binding` is the initiating session: required for reauth and replace, absent for signin (a schema check enforces both). */
export async function createNostrChallenge(
  sql: Sql, lang: Lang, returnTo: string, purpose: Purpose = "signin", binding?: { accountId: string; sessionTokenHash: Buffer },
): Promise<{ challengeId: string; nonce: string; preauth: string }> {
  const nonce = randomBytes(32).toString("base64url");
  const preauth = randomBytes(32).toString("base64url");
  const [row] = await sql<{ id: string }[]>`
    insert into auth_challenges (purpose, provider, secret_hash, binding_hash, lang, return_to, account_id, session_token_hash, expires_at)
    values (${purpose}, 'nostr', ${sha256(nonce)}, ${sha256(preauth)}, ${lang}, ${returnTo},
      ${binding?.accountId ?? null}, ${binding?.sessionTokenHash ?? null}, now() + interval '5 minutes')
    returning id`;
  return { challengeId: row!.id, nonce, preauth };
}

/** Caller owns the transaction: consumption must commit with account/session creation. */
/**
 * A challenge is spent only for the purpose it was created for. For reauth and replace, `session` must be the very
 * session that asked for it, on the same account: a challenge can never be carried to another account or session.
 */
export async function consumeNostrChallenge(
  sql: Sql, id: string, nonce: string, preauth: string, purpose: Purpose = "signin", session?: { accountId: string; tokenHash: Buffer },
): Promise<{ lang: Lang; returnTo: string } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || !TOKEN.test(nonce) || !TOKEN.test(preauth)) return null;
  if ((purpose === "signin") !== (session === undefined)) return null;
  const [row] = await sql<{ lang: Lang; return_to: string }[]>`
    update auth_challenges set used_at = now()
    where id = ${id} and secret_hash = ${sha256(nonce)} and binding_hash = ${sha256(preauth)}
      and purpose = ${purpose} and provider = 'nostr' and used_at is null and expires_at > now()
      and account_id is not distinct from ${session?.accountId ?? null}
      and session_token_hash is not distinct from ${session?.tokenHash ?? null}
    returning lang, return_to`;
  return row ? { lang: row.lang, returnTo: row.return_to } : null;
}

export async function createChallenge(
  sql: Sql,
  c: {
    purpose: Purpose;
    provider: "github";
    accountId?: string;
    sessionTokenHash?: Buffer;
    lang: Lang;
    returnTo: string;
    pkceVerifier: string;
  },
): Promise<{ secret: string; preauth: string }> {
  const secret = randomBytes(32).toString("base64url");
  const preauth = randomBytes(32).toString("base64url");
  await sql`
    insert into auth_challenges
      (purpose, provider, secret_hash, pkce_verifier, account_id, binding_hash, lang, return_to, session_token_hash, expires_at)
    values (${c.purpose}, ${c.provider}, ${sha256(secret)}, ${c.pkceVerifier}, ${c.accountId ?? null},
      ${sha256(preauth)}, ${c.lang}, ${c.returnTo}, ${c.sessionTokenHash ?? null}, now() + interval '10 minutes')`;
  return { secret, preauth };
}

/** Single-use: one UPDATE claims the challenge, so two callbacks can never both win. */
export async function consumeChallenge(
  sql: Sql,
  c: { secret: string; preauth: string; provider: "github" },
): Promise<{
  purpose: Purpose;
  accountId: string | null;
  sessionTokenHash: Buffer | null;
  lang: Lang;
  returnTo: string;
  pkceVerifier: string;
} | null> {
  if (!TOKEN.test(c.secret) || !TOKEN.test(c.preauth)) return null;
  const rows = await sql<
    { purpose: Purpose; account_id: string | null; session_token_hash: Buffer | null; lang: Lang; return_to: string; pkce_verifier: string | null }[]
  >`
    update auth_challenges set used_at = now()
    where secret_hash = ${sha256(c.secret)} and binding_hash = ${sha256(c.preauth)}
      and provider = ${c.provider} and used_at is null and expires_at > now()
    returning purpose, account_id, session_token_hash, lang, return_to, pkce_verifier`;
  const r = rows[0];
  if (!r) return null;
  return {
    purpose: r.purpose,
    accountId: r.account_id,
    sessionTokenHash: r.session_token_hash,
    lang: r.lang,
    returnTo: r.return_to,
    pkceVerifier: r.pkce_verifier ?? "",
  };
}

/** Read-only: the language of a still-live challenge, for error redirects. Never consumes it. */
export async function peekLang(sql: Sql, c: { secret: string; preauth: string }): Promise<Lang | null> {
  if (!TOKEN.test(c.secret) || !TOKEN.test(c.preauth)) return null;
  const rows = await sql<{ lang: Lang }[]>`
    select lang from auth_challenges
    where secret_hash = ${sha256(c.secret)} and binding_hash = ${sha256(c.preauth)} and used_at is null`;
  return rows[0]?.lang ?? null;
}

export function safeReturn(path: string | null, lang: Lang): string {
  const fallback = `/${lang}/account/`;
  if (!path || path.length > 200) return fallback;
  if (!/^\/(sw|en)\/[a-z0-9/_-]*$/.test(path)) return fallback;
  if (path.includes("..") || path.includes("//")) return fallback;
  return path;
}
