import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "./http.ts";

type Lang = "sw" | "en";
type Purpose = "signin" | "reauth" | "replace";

const sha256 = (s: string): Buffer => createHash("sha256").update(s).digest();
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

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
