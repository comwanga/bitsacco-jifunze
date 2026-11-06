import { afterEach, expect, test, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

test("production metadata defaults to the registered root domain", async () => {
  vi.stubEnv("SITE_ORIGIN", "");
  vi.resetModules();
  const site = await import("../../lib/site");
  expect(site.SITE_URL).toBe("https://bitsaccojifunze.xyz");
  expect(site.SITE_INDEXABLE).toBe(true);
  expect(site.ACCOUNTS_AVAILABLE).toBe(false);
});

test("staging metadata and sitemap use the configured origin and robots prohibit indexing", async () => {
  vi.stubEnv("SITE_ORIGIN", "https://staging.bitsaccojifunze.xyz");
  vi.resetModules();
  const site = await import("../../lib/site");
  const { default: robots } = await import("../../app/robots");
  const { default: sitemap } = await import("../../app/sitemap");
  expect(site.SITE_URL).toBe("https://staging.bitsaccojifunze.xyz");
  expect(site.SITE_INDEXABLE).toBe(false);
  expect(site.ACCOUNTS_AVAILABLE).toBe(true);
  expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  expect(sitemap().every(entry => new URL(entry.url).origin === site.SITE_URL)).toBe(true);
});

test.each([
  "https://staging.bitsaccojifunze.xyz/", "https://staging.bitsaccojifunze.xyz/path",
  "https://staging.bitsaccojifunze.xyz?x=1", "https://user:password@example.test",
  "http://staging.bitsaccojifunze.xyz", "not-a-url",
])("rejects a non-origin or insecure deployment value (%s)", async origin => {
  vi.stubEnv("SITE_ORIGIN", origin);
  vi.resetModules();
  await expect(import("../../lib/site")).rejects.toThrow();
});

test("local HTTP origin remains usable without enabling indexing", async () => {
  vi.stubEnv("SITE_ORIGIN", "http://localhost:8080");
  vi.resetModules();
  const site = await import("../../lib/site");
  expect(site.SITE_URL).toBe("http://localhost:8080");
  expect(site.SITE_INDEXABLE).toBe(false);
});
