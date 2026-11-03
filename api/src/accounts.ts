import type { Sql } from "./http.ts";

export async function findOrCreateByGithub(
  sql: Sql,
  gh: { id: number; login: string; avatarUrl: string },
  lang: "sw" | "en",
): Promise<{ accountId: string; created: boolean }> {
  const uid = String(gh.id);
  const avatar = gh.avatarUrl === "" ? null : gh.avatarUrl;

  const refresh = async (): Promise<string | null> => {
    const rows = await sql<{ account_id: string }[]>`
      update identities set handle = ${gh.login}, avatar_url = ${avatar}, last_verified_at = now(), revoked_at = null
      where provider = 'github' and provider_uid = ${uid}
      returning account_id`;
    return rows[0]?.account_id ?? null;
  };

  const existing = await refresh();
  if (existing) return { accountId: existing, created: false };

  const made = await sql.begin(async (tx) => {
    const [acct] = await tx<{ id: string }[]>`insert into accounts (preferred_lang) values (${lang}) returning id`;
    const ins = await tx`
      insert into identities (account_id, provider, provider_uid, handle, avatar_url)
      values (${acct!.id}, 'github', ${uid}, ${gh.login}, ${avatar})
      on conflict (provider, provider_uid) do nothing returning 1`;
    if (ins.length === 0) {
      await tx`delete from accounts where id = ${acct!.id}`; // lost a race with a concurrent sign-in
      return null;
    }
    return acct!.id;
  });
  if (made) return { accountId: made, created: true };
  const raced = await refresh();
  if (!raced) throw new Error("identity vanished during sign-in");
  return { accountId: raced, created: false };
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
