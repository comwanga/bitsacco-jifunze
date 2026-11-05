import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { pubkeyOf, TESTERS } from "./e2e-allowlist/testers";

// Tester allowlist in the browser: the static export (run `npm run build` first) behind scripts/serve-out.mjs, which
// proxies /api/ to the real API with an allowlist set, which talks to a fake GitHub. Needs TEST_DATABASE_URL (a
// throwaway database). Removing a tester needs an API restart, so that case is in api/test/tester-allowlist.test.ts.
const SITE = "http://localhost:4362";
const FAKE_GITHUB = "http://localhost:4360";
const API = "http://127.0.0.1:4361";
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is not set; the allowlist browser checks need a PostgreSQL test database");

const github = { GITHUB_CLIENT_ID: "e2e-fake-client-id", GITHUB_CLIENT_SECRET: "e2e-fake-client-secret" };
const testers = Object.values(TESTERS);

export default defineConfig({
  testDir: "e2e-allowlist",
  workers: 1,
  retries: 0, // the recovery limit is real, and a retry would spend more attempts
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { ...devices["Desktop Chrome"], baseURL: SITE, viewport: { width: 1280, height: 800 }, trace: "retain-on-failure" },
  webServer: [
    {
      command: "node api/test/fake-github-server.ts",
      url: "http://127.0.0.1:4360/",
      env: { ...github, SITE_ORIGIN: SITE, FAKE_GITHUB_PORT: "4360" },
      reuseExistingServer: false,
    },
    {
      command: "node api/src/main.ts",
      url: `${API}/api/health`,
      env: {
        ...github,
        PORT: "4361",
        DATABASE_URL: databaseUrl,
        SITE_ORIGIN: SITE,
        GITHUB_OAUTH_BASE: FAKE_GITHUB,
        GITHUB_API_BASE: FAKE_GITHUB,
        RECOVERY_PEPPER_V1: randomBytes(32).toString("base64"),
        TESTER_GITHUB_IDS: testers.map((t) => t.github.id).join(","),
        TESTER_NOSTR_PUBKEYS: testers.map((t) => pubkeyOf(t.nostrKey)).join(","),
      },
      reuseExistingServer: false,
    },
    {
      command: "node scripts/serve-out.mjs out 4362",
      url: `${SITE}/sw/`,
      env: { API_PROXY: API },
      reuseExistingServer: false,
    },
  ],
});
