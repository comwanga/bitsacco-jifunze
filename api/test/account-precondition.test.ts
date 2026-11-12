import { afterEach, expect, test } from "vitest";
import type { LogLine, Session } from "../src/http.ts";
import { ORIGIN, startServer } from "./helpers.ts";

let close: (() => Promise<void>) | undefined;
afterEach(async () => { await close?.(); close = undefined; });
const headers = (token?: string, expected?: string) => ({
  Origin: ORIGIN, "X-Jifunze": "1", "Content-Type": "application/json",
  ...(token ? { Cookie: `__Host-jf_session=${token}` } : {}),
  ...(expected === undefined ? {} : { "X-Jifunze-Account": expected }),
});
async function fixture() {
  const writes: string[] = [], logs: LogLine[] = [];
  const session = (accountId: string): Session => ({ accountId, scope: "full", tokenHash: Buffer.alloc(32), reauthAt: new Date() });
  const server = await startServer([
    { method: "GET", path: "/api/current", auth: "full", handler: async (c) => ({ status: 200, json: { id: c.session!.accountId } }) },
    { method: "POST", path: "/api/write", auth: "full", handler: async (c) => { writes.push(c.session!.accountId); return { status: 204 }; } },
  ], {
    readSession: async (_sql, token) => token === "token-a" ? session("acct-a") : token === "token-b" ? session("acct-b") : null,
    log: (line) => { logs.push(line); },
  });
  close = server.close;
  return { ...server, writes, logs };
}

test("a matching account precondition leaves the cookie as the only authority", async () => {
  const s = await fixture();
  const read = await fetch(`${s.base}/api/current`, { headers: headers("token-a", "acct-a") });
  expect(await read.json()).toEqual({ id: "acct-a" });
  expect((await fetch(`${s.base}/api/write`, { method: "POST", headers: headers("token-a", "acct-a") })).status).toBe(204);
  expect(s.writes).toEqual(["acct-a"]);
});

test("a cookie change after the page's check rejects the mutation before its handler", async () => {
  const s = await fixture();
  expect((await fetch(`${s.base}/api/current`, { headers: headers("token-a", "acct-a") })).status).toBe(200);
  const switched = await fetch(`${s.base}/api/write`, { method: "POST", headers: headers("token-b", "acct-a") });
  expect(switched.status).toBe(409);
  const error = await switched.json() as { error: { code: string } };
  expect(error.error.code).toBe("account_changed");
  expect(s.writes).toEqual([]); // no operation for A or B; the header never selects A
});

test("an account precondition cannot authenticate a request", async () => {
  const s = await fixture();
  expect((await fetch(`${s.base}/api/write`, { method: "POST", headers: headers(undefined, "acct-a") })).status).toBe(401);
  expect(s.writes).toEqual([]);
});

test("existing clients without the optional precondition remain scoped to their own cookie", async () => {
  const s = await fixture();
  expect((await fetch(`${s.base}/api/write`, { method: "POST", headers: headers("token-b") })).status).toBe(204);
  expect(s.writes).toEqual(["acct-b"]);
});

test("authenticated request logs contain no account, cookie or expectation identifiers", async () => {
  const s = await fixture();
  await fetch(`${s.base}/api/current`, { headers: headers("token-a", "acct-a") });
  await fetch(`${s.base}/api/write`, { method: "POST", headers: headers("token-b", "acct-a") });
  expect(s.logs).toHaveLength(2);
  for (const line of s.logs) expect(Object.keys(line).sort()).toEqual(["method", "ms", "route", "status"]);
  expect(JSON.stringify(s.logs)).not.toMatch(/acct-a|acct-b|token-a|token-b|X-Jifunze-Account/i);
});
