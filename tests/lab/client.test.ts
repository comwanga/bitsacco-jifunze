import { describe, expect, test } from "vitest";
import { buildCsp } from "../../lib/build/csp.ts";
import { check, hello, LabError, run, status } from "../../lib/lab/client.ts";

const C = { url: "http://127.0.0.1:7777", token: "ABCD-EFGH-JKLM" };
const json = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("csp for lab pages", () => {
  test("lab pages may connect to the local bridge and Codespaces", () => {
    const csp = buildCsp([], { lab: true });
    expect(csp).toContain("connect-src 'self' http://127.0.0.1:7777 http://localhost:7777 https://*.app.github.dev");
  });
  test("other pages may not", () => {
    expect(buildCsp([])).not.toContain("127.0.0.1");
  });
});

describe("lab client", () => {
  test("hello returns the lab info, or null when nothing answers", async () => {
    expect(await hello(C.url, json(200, { lab: "jifunze", version: "1" }))).toEqual({ lab: "jifunze", version: "1" });
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await hello(C.url, down)).toBeNull();
    expect(await hello(C.url, json(200, { something: "else" }))).toBeNull();
  });

  test("a network failure becomes 'not-found'", async () => {
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(status(C, down)).rejects.toMatchObject({ kind: "not-found" });
  });

  test("401 becomes 'unauthorized', 403 'forbidden', 500 'server'", async () => {
    await expect(run(C, { exercise: "x", node: "alice", tab: "cli", code: "ls" }, json(401, { error: "no" }))).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(check(C, "x", json(403, { error: "origin" }))).rejects.toMatchObject({ kind: "forbidden" });
    await expect(check(C, "x", json(500, { error: "boom" }))).rejects.toBeInstanceOf(LabError);
  });

  test("run sends the token without dashes being a problem and returns the result", async () => {
    let seen: RequestInit | undefined;
    const spy = (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response(JSON.stringify({ stdout: "hi", stderr: "", exitCode: 0, ms: 3, timedOut: false, truncated: false }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await run(C, { exercise: "x", node: "alice", tab: "cli", code: "echo hi" }, spy);
    expect(r.stdout).toBe("hi");
    expect((seen!.headers as Record<string, string>).authorization).toBe("Bearer ABCD-EFGH-JKLM");
    expect(JSON.parse(seen!.body as string).code).toBe("echo hi");
  });
});
