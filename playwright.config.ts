import { defineConfig, devices } from "@playwright/test";

const externalURL = process.env.PLAYWRIGHT_BASE_URL;

// Browser checks run against the static export in out/ (run `npm run build` first).
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { baseURL: externalURL || "http://localhost:4321", trace: "retain-on-failure" },
  webServer: externalURL ? undefined : {
    command: "node scripts/serve-out.mjs out 4321",
    url: "http://localhost:4321/sw/",
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
