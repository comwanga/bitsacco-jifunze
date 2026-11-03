import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { Config } from "../src/config.ts";
import type { ReadSession, Route, Sql } from "../src/http.ts";
import { createServer } from "../src/http.ts";

export const ORIGIN = "https://jifunze.test";

export function fakeConfig(over: Partial<Config> = {}): Config {
  return {
    siteOrigin: ORIGIN,
    port: 0,
    databaseUrl: "postgres://fake:fake@localhost/fake",
    githubClientId: "fake-client-id",
    githubClientSecret: "fake-client-secret",
    githubOAuthBase: "http://127.0.0.1:1",
    githubApiBase: "http://127.0.0.1:1",
    peppers: new Map([[1, Buffer.alloc(32, 1)]]),
    currentPepper: 1,
    ...over,
  };
}

export async function startServer(
  routes: Route[],
  opts: { readSession?: ReadSession; cfg?: Config } = {},
): Promise<{ base: string; close: () => Promise<void>; server: Server }> {
  const server = createServer(routes, {
    cfg: opts.cfg ?? fakeConfig(),
    sql: {} as unknown as Sql,
    readSession: opts.readSession ?? (async () => null),
    log: () => {},
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
