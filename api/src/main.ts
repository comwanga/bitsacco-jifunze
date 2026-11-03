import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
import { connect, errorCode, migrate, MigrationError } from "./db.ts";
import { createServer, type ReadSession } from "./http.ts";
import { routes } from "./routes.ts";

const cfg = loadConfig(process.env);
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

// Sessions arrive in a later task; until then every request is anonymous.
const readSession: ReadSession = async () => null;

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
