import { defineConfig } from "@playwright/test";
import accountConfig from "./playwright.account.config";

// A fresh API per suite preserves the real recovery limit (five attempts per source per 15 minutes).
// Run after the compatibility account suite, never concurrently with it. No rate-limit bypasses.
export default defineConfig({
  ...accountConfig,
  testDir: "e2e-learner-account", workers: 1, fullyParallel: false, retries: 0,
  projects: accountConfig.projects?.filter((p) => p.name === "chromium"),
});
