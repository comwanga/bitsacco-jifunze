import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { Config } from "../src/config.ts";
import type { ErrorLogLine, ReadSession, Route, Sql } from "../src/http.ts";
import { createServer } from "../src/http.ts";

export const ORIGIN = "https://jifunze.test";

export function fakeConfig(over: Partial<Config> = {}): Config {
  return {
    siteOrigin: ORIGIN,
    port: 0,
    databaseUrl: "postgres://fake:fake@localhost/fake",
    githubEnabled: true,
    githubClientId: "fake-client-id",
    githubClientSecret: "fake-client-secret",
    githubOAuthBase: "http://127.0.0.1:1",
    githubApiBase: "http://127.0.0.1:1",
    peppers: new Map([[1, Buffer.alloc(32, 1)]]),
    currentPepper: 1,
    testerAllowlist: null,
    testerAllowlistInvalid: [],
    ...over,
  };
}

export async function startServer(
  routes: Route[],
  opts: { readSession?: ReadSession; cfg?: Config; logError?: (l: ErrorLogLine) => void } = {},
): Promise<{ base: string; close: () => Promise<void>; server: Server }> {
  const server = createServer(routes, {
    cfg: opts.cfg ?? fakeConfig(),
    sql: {} as unknown as Sql,
    readSession: opts.readSession ?? (async () => null),
    log: () => {},
    logError: opts.logError ?? (() => {}),
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    base: `http://127.0.0.1:${port}`,
    server,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set; API database tests need a PostgreSQL test database");
  }
  return url;
}

export async function resetTestDb(sql: Sql): Promise<void> {
  await sql.unsafe("drop schema public cascade; create schema public;");
}
