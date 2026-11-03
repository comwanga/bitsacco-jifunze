import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connect, migrate } from "../src/db.ts";
import { resetTestDb, testDatabaseUrl } from "./helpers.ts";

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

async function rejects(p: PromiseLike<unknown>, code: string): Promise<void> {
  await expect(Promise.resolve(p)).rejects.toMatchObject({ code });
}

const hash = () => Buffer.alloc(32, 7);

describe("migrations", () => {
  it("migrate applies 0001 once and records it in schema_migrations; a second run applies nothing", async () => {
    await resetTestDb(sql);
    expect(await migrate(sql, dir)).toEqual(["0001_accounts.sql"]);
    expect(await migrate(sql, dir)).toEqual([]);
    const rows = await sql`select name from schema_migrations`;
    expect(rows.map((r) => r.name)).toEqual(["0001_accounts.sql"]);
  });

  it("identities enforce unique (provider, provider_uid) and unique (account_id, provider)", async () => {
    const a = await newAccount();
    const b = await newAccount();
    await sql`insert into identities (account_id, provider, provider_uid) values (${a}, 'github', '1')`;
    await rejects(sql`insert into identities (account_id, provider, provider_uid) values (${b}, 'github', '1')`, "23505");
    await rejects(sql`insert into identities (account_id, provider, provider_uid) values (${a}, 'github', '2')`, "23505");
    await sql`insert into identities (account_id, provider, provider_uid) values (${a}, 'nostr', '1')`;
  });

  it("deleting an account cascades identities, sessions, challenges and recovery codes", async () => {
    const a = await newAccount();
    await sql`insert into identities (account_id, provider, provider_uid) values (${a}, 'github', '1')`;
    await sql`insert into sessions (token_hash, account_id, expires_at, scope) values (${hash()}, ${a}, now() + interval '1 day', 'full')`;
    await sql`insert into auth_challenges (purpose, provider, secret_hash, account_id, binding_hash, lang, return_to, expires_at, session_token_hash)
      values ('reauth', 'github', ${Buffer.alloc(32, 1)}, ${a}, ${hash()}, 'en', '/en/', now() + interval '10 minutes', ${hash()})`;
    await sql`insert into recovery_codes (code_hash, pepper_version, account_id, set_id) values (${hash()}, 1, ${a}, gen_random_uuid())`;
    await sql`delete from accounts where id = ${a}`;
    for (const t of ["identities", "sessions", "auth_challenges", "recovery_codes"]) {
      const [r] = await sql.unsafe(`select count(*)::int as n from ${t}`);
      expect(r!.n, t).toBe(0);
    }
  });

  it("security_events keep rows with account_id null after deletion", async () => {
    const a = await newAccount();
    await sql`insert into security_events (account_id, event) values (${a}, 'signin')`;
    await sql`delete from accounts where id = ${a}`;
    const rows = await sql`select account_id, event from security_events`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.account_id).toBeNull();
  });

  it("an auth_challenges row with purpose reauth or replace and no session_token_hash is rejected by the constraint, and a signin row with one is rejected too", async () => {
    const a = await newAccount();
    const insert = (purpose: string, sth: Buffer | null) => sql`
      insert into auth_challenges (purpose, provider, secret_hash, account_id, binding_hash, lang, return_to, expires_at, session_token_hash)
      values (${purpose}, 'github', ${Buffer.from(crypto.getRandomValues(new Uint8Array(32)))}, ${a}, ${hash()}, 'sw', '/sw/', now() + interval '10 minutes', ${sth})`;
    await rejects(insert("reauth", null), "23514");
    await rejects(insert("replace", null), "23514");
    await rejects(insert("signin", hash()), "23514");
    await insert("signin", null);
    await insert("reauth", hash());
    await insert("replace", hash());
  });
});
