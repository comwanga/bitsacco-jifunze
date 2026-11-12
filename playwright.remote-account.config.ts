import { defineConfig } from "@playwright/test";
import accountConfig from "./playwright.account.config";
export default defineConfig({ ...accountConfig, testDir: "e2e-remote-account", workers: 1, fullyParallel: false, retries: 0,
  projects: accountConfig.projects?.filter((p) => p.name === "chromium"), });
