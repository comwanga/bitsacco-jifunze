import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Account browser checks: the static export (run `npm run build` first) behind scripts/serve-out.mjs, which
// proxies /api/ to the real API, which talks to a fake GitHub. Needs TEST_DATABASE_URL (a throwaway database).
// Chromium only: the session cookie is __Host- and Secure, which WebKit refuses on http://localhost.
const SITE = "http://localhost:4352";
const FAKE_GITHUB = "http://localhost:4350";
const API = "http://127.0.0.1:4351";
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is not set; the account browser checks need a PostgreSQL test database");

// Throwaway values for a fake GitHub; the pepper is new on every run.
const github = { GITHUB_CLIENT_ID: "e2e-fake-client-id", GITHUB_CLIENT_SECRET: "e2e-fake-client-secret" };

export default defineConfig({
  testDir: "e2e-account",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { baseURL: SITE, trace: "retain-on-failure" },
  // Never reused: a fresh API starts with empty in-memory rate limits.
  webServer: [
    {
      command: "node api/test/fake-github-server.ts",
      url: "http://127.0.0.1:4350/",
      env: { ...github, SITE_ORIGIN: SITE, FAKE_GITHUB_PORT: "4350" },
      reuseExistingServer: false,
    },
    {
      command: "node api/src/main.ts",
      url: `${API}/api/health`,
      env: {
        ...github,
        PORT: "4351",
        DATABASE_URL: databaseUrl,
        SITE_ORIGIN: SITE,
        GITHUB_OAUTH_BASE: FAKE_GITHUB,
        GITHUB_API_BASE: FAKE_GITHUB,
        RECOVERY_PEPPER_V1: randomBytes(32).toString("base64"),
      },
      reuseExistingServer: false,
    },
    {
      command: "node scripts/serve-out.mjs out 4352",
      url: `${SITE}/sw/`,
      env: { API_PROXY: API },
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: "chromium", testIgnore: "**/nostr-bfcache.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "chromium-bfcache",
      testMatch: "**/nostr-bfcache.spec.ts",
      // The default headless shell disables BFCache. Full Chromium is required for a real restore.
      use: {
        ...devices["Desktop Chrome"], channel: "chromium",
        launchOptions: { ignoreDefaultArgs: ["--disable-back-forward-cache"] },
        viewport: { width: 1280, height: 800 }, serviceWorkers: "block", trace: "off",
      },
    },
  ],
});
