import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig } from "../src/config.ts";
import { clientIp, type Route } from "../src/http.ts";
import { healthRoute } from "../src/routes.ts";
import { ORIGIN, startServer } from "./helpers.ts";

const post = { Origin: ORIGIN, "X-Jifunze": "1", "Content-Type": "application/json" };

const routes: Route[] = [
  healthRoute,
  { method: "GET", path: "/api/ip", auth: "public", handler: async (c) => ({ status: 200, json: { ip: c.ip } }) },
  {
    method: "GET",
    path: "/api/boom",
    auth: "public",
    handler: async () => {
      throw new Error("secret stack detail");
    },
  },
  { method: "GET", path: "/api/things/:id", auth: "public", handler: async (c) => ({ status: 200, json: c.params }) },
  { method: "GET", path: "/api/private", auth: "full", handler: async () => ({ status: 200, json: {} }) },
  {
    method: "POST",
    path: "/api/echo",
    auth: "public",
    body: z.object({ n: z.number() }),
    handler: async (c) => ({ status: 200, json: c.body }),
  },
];

let s: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  s = await startServer(routes);
});
afterAll(async () => {
  await s.close();
});

async function json(r: Response): Promise<any> {
  return r.json();
}

function expectHeaders(r: Response) {
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(r.headers.get("x-robots-tag")).toBe("noindex");
  expect(r.headers.get("referrer-policy")).toBe("no-referrer");
  expect(r.headers.get("vary")).toBe("Cookie");
}

describe("api pipeline", () => {
  it("unknown path -> 404 not_found with bilingual messages", async () => {
    const r = await fetch(`${s.base}/api/nope`);
    expect(r.status).toBe(404);
    const j = await json(r);
    expect(j.error.code).toBe("not_found");
    expect(typeof j.error.message_sw).toBe("string");
    expect(typeof j.error.message_en).toBe("string");
  });

  it("wrong method -> 405 method_not_allowed", async () => {
    const r = await fetch(`${s.base}/api/health`, { method: "POST", headers: post, body: "{}" });
    expect(r.status).toBe(405);
    expect((await json(r)).error.code).toBe("method_not_allowed");
  });

  it("every response has the privacy headers, including 404, 405 and 500", async () => {
    expectHeaders(await fetch(`${s.base}/api/health`));
    expectHeaders(await fetch(`${s.base}/api/nope`));
    expectHeaders(await fetch(`${s.base}/api/health`, { method: "POST", headers: post, body: "{}" }));
    expectHeaders(await fetch(`${s.base}/api/boom`));
  });

  it("POST without Origin, wrong Origin, or without X-Jifunze -> 403 bad_origin", async () => {
    const body = JSON.stringify({ n: 1 });
    const variants: Record<string, string>[] = [
      { "Content-Type": "application/json", "X-Jifunze": "1" },
      { ...post, Origin: "https://evil.test" },
      { ...post, Origin: ORIGIN + "/" },
      { Origin: ORIGIN, "Content-Type": "application/json" },
    ];
    for (const headers of variants) {
      const r = await fetch(`${s.base}/api/echo`, { method: "POST", headers, body });
      expect(r.status).toBe(403);
      expect((await json(r)).error.code).toBe("bad_origin");
    }
  });

  it("POST with a non-JSON content type -> 400 bad_request", async () => {
    const r = await fetch(`${s.base}/api/echo`, {
      method: "POST",
      headers: { ...post, "Content-Type": "text/plain" },
      body: "n=1",
    });
    expect(r.status).toBe(400);
    expect((await json(r)).error.code).toBe("bad_request");
  });

  it("a body over 16 KB -> 413 payload_too_large", async () => {
    const r = await fetch(`${s.base}/api/echo`, {
      method: "POST",
      headers: post,
      body: JSON.stringify({ n: 1, pad: "x".repeat(17 * 1024) }),
    });
    expect(r.status).toBe(413);
    expect((await json(r)).error.code).toBe("payload_too_large");
  });

  it("a zod-invalid body -> 400 bad_request; a valid one reaches the handler", async () => {
    const bad = await fetch(`${s.base}/api/echo`, { method: "POST", headers: post, body: JSON.stringify({ n: "x" }) });
    expect(bad.status).toBe(400);
    expect((await json(bad)).error.code).toBe("bad_request");
    const notJson = await fetch(`${s.base}/api/echo`, { method: "POST", headers: post, body: "{" });
    expect(notJson.status).toBe(400);
    const ok = await fetch(`${s.base}/api/echo`, { method: "POST", headers: post, body: JSON.stringify({ n: 2 }) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ n: 2 });
  });

  it('auth "full" with no session -> 401 unauthenticated', async () => {
    const r = await fetch(`${s.base}/api/private`);
    expect(r.status).toBe(401);
    expect((await json(r)).error.code).toBe("unauthenticated");
  });

  it("a handler throw -> 500 internal with no stack trace", async () => {
    const r = await fetch(`${s.base}/api/boom`);
    expect(r.status).toBe(500);
    const text = await r.text();
    expect(JSON.parse(text).error.code).toBe("internal");
    expect(text).not.toContain("secret stack detail");
    expect(text).not.toContain(" at ");
  });

  it("matches :param segments", async () => {
    const r = await fetch(`${s.base}/api/things/abc`);
    expect(await r.json()).toEqual({ id: "abc" });
  });

  it("client IP uses X-Real-IP only from loopback or private sockets", async () => {
    // The test socket is loopback, so the header is honoured.
    const r = await fetch(`${s.base}/api/ip`, { headers: { "X-Real-IP": "203.0.113.9" } });
    expect((await json(r)).ip).toBe("203.0.113.9");
    expect(clientIp("127.0.0.1", "203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("::1", "203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("::ffff:10.1.2.3", "203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("172.18.0.5", "203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("192.168.1.5", "203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("198.51.100.7", "203.0.113.9")).toBe("198.51.100.7");
    expect(clientIp("2001:db8::1", "203.0.113.9")).toBe("2001:db8::1");
    expect(clientIp("127.0.0.1", undefined)).toBe("127.0.0.1");
  });

  it("GET /api/health -> 200 {ok:true}", async () => {
    const r = await fetch(`${s.base}/api/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});

describe("loadConfig", () => {
  it("throws listing missing keys and no values", () => {
    const env = { SITE_ORIGIN: "https://jifunze.test", GITHUB_CLIENT_SECRET: "fake-super-secret-value" };
    let msg = "";
    try {
      loadConfig(env);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("DATABASE_URL");
    expect(msg).toContain("GITHUB_CLIENT_ID");
    expect(msg).toContain("RECOVERY_PEPPER_V1");
    expect(msg).not.toContain("fake-super-secret-value");
    expect(msg).not.toContain("https://jifunze.test");
  });

  it("loads a full config with defaults and picks the highest pepper", () => {
    const b64 = Buffer.alloc(32, 7).toString("base64");
    const cfg = loadConfig({
      SITE_ORIGIN: "https://jifunze.test",
      DATABASE_URL: "postgres://fake",
      GITHUB_CLIENT_ID: "id",
      GITHUB_CLIENT_SECRET: "secret",
      RECOVERY_PEPPER_V1: b64,
      RECOVERY_PEPPER_V2: b64,
    });
    expect(cfg.port).toBe(3001);
    expect(cfg.githubOAuthBase).toBe("https://github.com");
    expect(cfg.githubApiBase).toBe("https://api.github.com");
    expect(cfg.currentPepper).toBe(2);
    expect(cfg.peppers.size).toBe(2);
  });

  it("rejects a short pepper by key name only", () => {
    const short = Buffer.alloc(8, 1).toString("base64");
    expect(() =>
      loadConfig({
        SITE_ORIGIN: "x",
        DATABASE_URL: "x",
        GITHUB_CLIENT_ID: "x",
        GITHUB_CLIENT_SECRET: "x",
        RECOVERY_PEPPER_V1: short,
      }),
    ).toThrow(/RECOVERY_PEPPER_V1/);
  });
});
