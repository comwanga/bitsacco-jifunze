import { afterEach, expect, test, vi } from "vitest";
import { apiFetch } from "../../components/account/api.ts";
import { accountCopy, errorText } from "../../lib/account-copy.ts";

afterEach(() => vi.unstubAllGlobals());

const respondWith = (body: string, status: number) => vi.stubGlobal("fetch", async () => new Response(body, { status }));
const code = async () => {
  const result = await apiFetch("/api/me");
  return result.ok ? null : result.code;
};

test.each([502, 503, 504])("a proxy's %i page is not blamed on the reader's connection, in either language", async (status) => {
  respondWith("<html><h1>Service Unavailable</h1></html>", status);
  const result = await code();
  expect(result).toBe("internal");
  for (const lang of ["en", "sw"] as const) expect(errorText(lang, result)).toBe(accountCopy[lang].error_internal);
});

test("a request that never completes still means the connection or service could not be reached", async () => {
  vi.stubGlobal("fetch", async () => { throw new TypeError("failed to fetch"); });
  expect(await code()).toBe("network");
});

test("a 404 page from a host with no account service still counts as not reached", async () => {
  respondWith("<html>not found</html>", 404);
  expect(await code()).toBe("network");
});

test("the API's own error code is passed on unchanged", async () => {
  respondWith(JSON.stringify({ error: { code: "unauthenticated" } }), 401);
  expect(await code()).toBe("unauthenticated");
  respondWith(JSON.stringify({ error: { code: "github_failed" } }), 502);
  expect(await code()).toBe("github_failed");
});
