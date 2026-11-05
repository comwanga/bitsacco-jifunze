import type { Sql } from "./http.ts";

/*
 * Tester-only authentication for non-production deployments. Learning content never reaches this code.
 *
 * Enforced where an identity has been proven and where a session is used: the GitHub callback (sign-in, reauth,
 * replace), Nostr verify, recovery redemption and the session gate in http.ts. A refusal reuses the error a stale
 * request gets, so the answer does not say that an allowlist decided it.
 *
 * A missing, empty or malformed list denies everyone instead of stopping the process: a failed boot could leave the
 * platform serving the previous deployment, which may have no allowlist at all.
 */

export type Provider = "github" | "nostr";
export type TesterAllowlist = Readonly<Record<Provider, ReadonlySet<string>>>;

const PRODUCTION_ORIGIN = "https://bitsaccojifunze.xyz";

const validGithubId = (v: string) => /^[1-9][0-9]*$/.test(v) && Number.isSafeInteger(Number(v));
const validNostrPubkey = (v: string) => /^[0-9a-f]{64}$/.test(v);

/** Null when any entry is malformed. A blank value is an empty list. */
function parseList(raw: string | undefined, valid: (v: string) => boolean): Set<string> | null {
  if (!raw || raw.trim() === "") return new Set();
  const entries = raw.split(",").map((e) => e.trim());
  return entries.every(valid) ? new Set(entries) : null;
}

/** Errors name keys only, never values. */
export function loadTesterAllowlist(env: NodeJS.ProcessEnv): { allowlist: TesterAllowlist | null; invalid: string[] } {
  const railwayEnv = env.RAILWAY_ENVIRONMENT_NAME;
  const isProduction = railwayEnv === "production" && env.SITE_ORIGIN === PRODUCTION_ORIGIN;
  const required = Boolean(railwayEnv) && !isProduction;
  const present = env.TESTER_GITHUB_IDS !== undefined || env.TESTER_NOSTR_PUBKEYS !== undefined;
  if (!required && !present) return { allowlist: null, invalid: [] };

  const github = parseList(env.TESTER_GITHUB_IDS, validGithubId);
  const nostr = parseList(env.TESTER_NOSTR_PUBKEYS, validNostrPubkey);
  const invalid = [...(github ? [] : ["TESTER_GITHUB_IDS"]), ...(nostr ? [] : ["TESTER_NOSTR_PUBKEYS"])];
  if (!github || !nostr) return { allowlist: { github: new Set(), nostr: new Set() }, invalid };
  return { allowlist: { github, nostr }, invalid };
}

export function identityAllowed(list: TesterAllowlist | null, provider: Provider, uid: string): boolean {
  return list === null || list[provider].has(uid);
}

/** Whether the account holds an unrevoked allowlisted identity, so removing a tester ends their access. */
export async function accountAllowed(sql: Sql, list: TesterAllowlist | null, accountId: string): Promise<boolean> {
  if (list === null) return true;
  const rows = await sql<{ provider: Provider; provider_uid: string }[]>`
    select provider, provider_uid from identities where account_id = ${accountId} and revoked_at is null`;
  return rows.some((r) => identityAllowed(list, r.provider, r.provider_uid));
}
