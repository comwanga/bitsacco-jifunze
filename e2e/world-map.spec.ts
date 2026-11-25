import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { getWorldGroups } from "../lib/content/load.ts";
import { project } from "../lib/map/project.ts";

test("every marker sits on a land dot in the generated map", () => {
  const svg = fs.readFileSync("public/images/world-dots.svg", "utf8");
  const dots = [...svg.matchAll(/M([\d.]+) ([\d.]+)h0/g)].map((m) => ({ x: +m[1], y: +m[2] }));
  expect(dots.length).toBeGreaterThan(1000);
  for (const g of getWorldGroups()) {
    const p = project(g.lat, g.lon);
    const nearest = Math.min(...dots.map((d) => Math.hypot(d.x - p.x, d.y - p.y)));
    expect(nearest, g.id).toBeLessThan(12);
  }
});

test("the map image loads and has six markers", async ({ page }) => {
  const res = page.waitForResponse((r) => r.url().endsWith("/images/world-dots.svg"));
  await page.goto("/en/");
  expect((await res).status()).toBe(200);
  await expect(page.locator("[data-world-map] svg [data-marker]")).toHaveCount(6);
});

test("the map is available offline after the first visit", async ({ page, context }) => {
  await page.goto("/sw/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  const ok = await page.evaluate(async () => (await caches.match("/images/world-dots.svg")) !== undefined);
  expect(ok).toBe(true);
  await context.setOffline(false);
});
