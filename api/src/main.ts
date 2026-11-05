import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
import { connect, errorCode, migrate, MigrationError } from "./db.ts";
import { createServer } from "./http.ts";
import { routes } from "./routes.ts";
import { purgeExpired, readSession } from "./sessions.ts";

const cfg = loadConfig(process.env);
// Counts and key names only: the identities themselves stay out of the logs.
console.info(JSON.stringify({
  event: "tester_allowlist",
  enforced: cfg.testerAllowlist !== null,
  github: cfg.testerAllowlist?.github.size ?? 0,
  nostr: cfg.testerAllowlist?.nostr.size ?? 0,
  invalid: cfg.testerAllowlistInvalid,
}));
let sql: ReturnType<typeof connect>;
try {
  sql = connect(cfg.databaseUrl);
  await migrate(
    sql,
    join(dirname(fileURLToPath(import.meta.url)), "..", "migrations"),
  );
} catch (err) {
  // Never log the error object: driver errors can carry the connection string or query parameters.
  const line =
    err instanceof MigrationError
      ? { event: "migration_failed", file: err.file, code: err.code }
      : { event: "boot_failed", code: errorCode(err) };
  console.error(JSON.stringify(line));
  process.exit(1);
}

// Purge once at boot and daily. Log counts only, never the error object.
async function purge(): Promise<void> {
  try {
    console.info(JSON.stringify({ event: "purged", ...(await purgeExpired(sql)) }));
  } catch (err) {
    console.error(JSON.stringify({ event: "purge_failed", code: errorCode(err) }));
  }
}
await purge();
setInterval(() => void purge(), 24 * 60 * 60 * 1000).unref();

const server = createServer(routes, { cfg, sql, readSession });
server.listen(cfg.port, () => {
  console.info(JSON.stringify({ event: "listening", port: cfg.port }));
});

async function shutdown(): Promise<void> {
  server.close();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
