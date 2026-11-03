import postgres from "postgres";
import { loadConfig } from "./config.ts";
import { createServer, type ReadSession } from "./http.ts";
import { routes } from "./routes.ts";

const cfg = loadConfig(process.env);
const sql = postgres(cfg.databaseUrl);

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
