import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import type { Sql } from "./http.ts";

export function connect(url: string): Sql {
  return postgres(url);
}

// Arbitrary constant: serialises concurrent migrators (e.g. two containers booting).
const MIGRATION_LOCK = 727_001;

/** Applies each unapplied *.sql file in name order, one transaction per file. Returns the names applied now. */
export async function migrate(sql: Sql, dir: string): Promise<string[]> {
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const name of files) {
    const text = await readFile(join(dir, name), "utf8");
    const didApply = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${MIGRATION_LOCK})`;
      const done = await tx`select 1 from schema_migrations where name = ${name}`;
      if (done.length > 0) return false;
      await tx.unsafe(text);
      await tx`insert into schema_migrations (name) values (${name})`;
      return true;
    });
    if (didApply) applied.push(name);
  }
  return applied;
}
