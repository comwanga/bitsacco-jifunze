import { defineConfig } from "@playwright/test";
import accountConfig from "./playwright.account.config";

// Separate API lifetime: preserve the real recovery/rate limits for all existing suites.
export default defineConfig({
  ...accountConfig,
  testDir: "e2e-device-account", workers: 1, fullyParallel: false, retries: 0,
  projects: accountConfig.projects?.filter((p) => p.name === "chromium"),
});
