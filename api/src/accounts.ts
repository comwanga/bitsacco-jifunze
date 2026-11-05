import { errorCode } from "./db.ts";
import { consumeNostrChallenge } from "./challenges.ts";
import { ApiError } from "./errors.ts";
import type { Session, Sql } from "./http.ts";
import { createSession, revokeOtherSessions, revokeSession } from "./sessions.ts";

type GithubUser = { id: number; login: string; avatarUrl: string };

/** Runs inside the caller's transaction (never opens one), so the caller can commit it with more work. */
async function findOrCreateIn(
  tx: Sql,
  gh: GithubUser,
  lang: "sw" | "en",
): Promise<{ accountId: string; created: boolean }> {
  const uid = String(gh.id);
  const avatar = gh.avatarUrl === "" ? null : gh.avatarUrl;

  const refresh = async (): Promise<string | null> => {
    const rows = await tx<{ account_id: string }[]>`
      update identities set handle = ${gh.login}, avatar_url = ${avatar}, last_verified_at = now(), revoked_at = null
      where provider = 'github' and provider_uid = ${uid}
      returning account_id`;
    return rows[0]?.account_id ?? null;
  };

  const existing = await refresh();
  if (existing) return { accountId: existing, created: false };

  const [acct] = await tx<{ id: string }[]>`insert into accounts (preferred_lang) values (${lang}) returning id`;
  // Waits for a concurrent sign-in holding the same uid, then does nothing if that one committed.
  const ins = await tx`
    insert into identities (account_id, provider, provider_uid, handle, avatar_url)
    values (${acct!.id}, 'github', ${uid}, ${gh.login}, ${avatar})
    on conflict (provider, provider_uid) do nothing returning 1`;
  if (ins.length === 1) return { accountId: acct!.id, created: true };
  await tx`delete from accounts where id = ${acct!.id}`; // lost a race with a concurrent sign-in
  const raced = await refresh();
  if (!raced) throw new Error("identity vanished during sign-in");
  return { accountId: raced, created: false };
}

export async function findOrCreateByGithub(
  sql: Sql,
  gh: GithubUser,
  lang: "sw" | "en",
): Promise<{ accountId: string; created: boolean }> {
  return sql.begin((tx) => findOrCreateIn(tx, gh, lang));
}

/**
 * Sign-in as one transaction: the account and identity (if new), the fresh full session, the
 * revocation of the browser's previous session and the event all commit together or not at all,
 * so a failure can never leave an orphan account behind.
 */
export async function signInWithGithub(
  sql: Sql,
  gh: GithubUser,
  lang: "sw" | "en",
  previous: Session | null,
): Promise<{ accountId: string; created: boolean; cookie: string }> {
  return sql.begin(async (tx) => {
    const { accountId, created } = await findOrCreateIn(tx, gh, lang);
    const fresh = await createSession(tx, accountId, "full");
    if (previous) await revokeSession(tx, previous.tokenHash);
    await logEvent(tx, accountId, "signin", { provider: "github", created: String(created) });
    return { accountId, created, cookie: fresh.cookie };
  });
}

const IDENTITY_UNIQUE = "identities_provider_provider_uid_key";

/** A proven pubkey is the sole provider identifier; never links to the previous session's account. */
export async function signInWithNostr(sql: Sql, pubkey: string, challenge: { challengeId: string; nonce: string; preauth: string }, previous: Session | null): Promise<{ cookie: string; redirect: string }> {
  return sql.begin(async (tx) => {
    const ch = await consumeNostrChallenge(tx, challenge.challengeId, challenge.nonce, challenge.preauth);
    if (!ch) throw new ApiError(401, "challenge_invalid");
    const refresh = async (): Promise<string | undefined> => {
      const [row] = await tx<{ account_id: string }[]>`
        update identities set last_verified_at = now()
        where provider = 'nostr' and provider_uid = ${pubkey} returning account_id`;
      return row?.account_id;
    };
    let accountId = await refresh();
    let created = false;
    if (!accountId) {
      const [acct] = await tx<{ id: string }[]>`insert into accounts (preferred_lang) values (${ch.lang}) returning id`;
      const ins = await tx`insert into identities (account_id, provider, provider_uid)
        values (${acct!.id}, 'nostr', ${pubkey}) on conflict (provider, provider_uid) do nothing returning 1`;
      if (ins.length === 1) { accountId = acct!.id; created = true; }
      else {
        await tx`delete from accounts where id = ${acct!.id}`;
        accountId = await refresh();
        if (!accountId) throw new Error("identity vanished during sign-in");
      }
    }
    const active = await tx`select 1 from accounts where id = ${accountId} and deleted_at is null for key share`;
    if (active.length === 0) throw new ApiError(401, "unauthenticated");
    const fresh = await createSession(tx, accountId, "full");
    if (previous) await revokeSession(tx, previous.tokenHash);
    await logEvent(tx, accountId, "signin", { provider: "nostr", created: String(created) });
    return { cookie: fresh.cookie, redirect: created ? `/${ch.lang}/account/welcome/` : ch.returnTo };
  });
}

/**
 * Replaces the account's GitHub identity. ONE transaction holds the identity change, the revocation of
 * every session of the account, the fresh full session and the event: all commit or none do.
 *  1. lock the account row FOR NO KEY UPDATE without waiting (a concurrent replacement → 409
 *     replace_conflict; inserts that merely reference the account, such as sessions, do not conflict);
 *  2. if `binding` is given, lock the initiating session row and require it to be live, of that scope,
 *     on this account (→ 401 unauthenticated). A concurrent revocation of it either committed first (and
 *     is seen here) or waits for this transaction. A full session must also have re-authenticated within
 *     the last 10 minutes (→ 403 reauth_required); a recovery session need not;
 *  3. (github, gh.id) on another account → 409 identity_in_use, also when a racing account commits it first;
 *  4. gh.id already this account's identity → "unchanged" (handle and avatar refreshed);
 *  5. otherwise delete this account's GitHub identity and insert the new one;
 *  6. in both outcomes: revoke all the account's sessions, create a fresh full session, log the event.
 */
export async function replaceGithubIdentity(
  sql: Sql,
  accountId: string,
  gh: GithubUser,
  binding?: { tokenHash: Buffer; scope: Session["scope"] },
): Promise<{ outcome: "replaced" | "unchanged"; cookie: string }> {
  const uid = String(gh.id);
  const avatar = gh.avatarUrl === "" ? null : gh.avatarUrl;
  try {
    return await sql.begin(async (tx) => {
      // Bounds every other wait in here (the session row lock, the unique index behind a racing insert).
      await tx`set local lock_timeout = '2s'`;
      const acct = await tx`
        select id from accounts where id = ${accountId} and deleted_at is null for no key update nowait`;
      if (acct.length === 0) throw new ApiError(401, "unauthenticated");
      // Replacement requires an existing identity of the same provider. Cross-provider linking is 2d.
      const existingGithub = await tx`select 1 from identities where account_id = ${accountId} and provider = 'github'`;
      if (existingGithub.length === 0) throw new ApiError(403, "nostr_lifecycle_pending");
      if (binding) {
        const [live] = await tx<{ fresh: boolean }[]>`
          select (scope = 'recovery' or reauth_at > now() - interval '10 minutes') as fresh from sessions
          where token_hash = ${binding.tokenHash} and account_id = ${accountId} and scope = ${binding.scope}
            and revoked_at is null and expires_at > now()
          for no key update`;
        if (!live) throw new ApiError(401, "unauthenticated");
        // Re-checked here, not only at start: the challenge lives 10 more minutes.
        if (!live.fresh) throw new ApiError(403, "reauth_required");
      }

      const [owner] = await tx<{ account_id: string }[]>`
        select account_id from identities where provider = 'github' and provider_uid = ${uid}`;
      if (owner && owner.account_id !== accountId) throw new ApiError(409, "identity_in_use");
      let outcome: "replaced" | "unchanged";
      if (owner) {
        await tx`update identities set handle = ${gh.login}, avatar_url = ${avatar}, last_verified_at = now(), revoked_at = null
          where provider = 'github' and provider_uid = ${uid}`;
        outcome = "unchanged";
      } else {
        await tx`delete from identities where account_id = ${accountId} and provider = 'github'`;
        try {
          await tx`
            insert into identities (account_id, provider, provider_uid, handle, avatar_url)
            values (${accountId}, 'github', ${uid}, ${gh.login}, ${avatar})`;
        } catch (e) {
          // Another account committed this uid after our check above.
          const constraint = (e as { constraint_name?: unknown } | null)?.constraint_name;
          if (errorCode(e) === "23505" && constraint === IDENTITY_UNIQUE) throw new ApiError(409, "identity_in_use");
          throw e;
        }
        outcome = "replaced";
      }

      await revokeOtherSessions(tx, accountId); // every session, the initiating one included
      const fresh = await createSession(tx, accountId, "full");
      await logEvent(tx, accountId, "identity_replaced", { provider: "github", outcome });
      return { outcome, cookie: fresh.cookie };
    });
  } catch (e) {
    // 55P03 lock_not_available: the NOWAIT row lock, or lock_timeout on any other wait.
    if (errorCode(e) === "55P03") throw new ApiError(409, "replace_conflict");
    throw e;
  }
}

/** detail carries no tokens and no IPs beyond a /24 prefix. */
export async function logEvent(
  sql: Sql,
  accountId: string | null,
  event: string,
  detail: Record<string, string> = {},
): Promise<void> {
  await sql`insert into security_events (account_id, event, detail) values (${accountId}, ${event}, ${sql.json(detail)})`;
}
