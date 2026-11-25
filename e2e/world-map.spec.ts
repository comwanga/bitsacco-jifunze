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

const mapStates = (page: import("@playwright/test").Page) =>
  page.locator("[data-world-map]").evaluate((el) => el.getAnimations({ subtree: true }).map((a) => ({ state: a.playState, iterations: a.effect?.getTiming().iterations })));

test("markers pulse and payment lines flow between the groups", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("[data-world-map] svg [data-arc]")).toHaveCount(8);
  await expect(page.locator("[data-world-map] svg [data-pulse]")).toHaveCount(6);
  const states = await mapStates(page);
  expect(states.length).toBe(14);
  expect(states.every((s) => s.state === "running" && s.iterations === Infinity)).toBe(true);
});

test("the map has no control and keeps moving when the circle is paused", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("[data-world-map] input, [data-world-map] button")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Pause the circle" }).check();
  expect((await mapStates(page)).every((s) => s.state === "running")).toBe(true);
});

test("reduced motion keeps the map still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  expect((await mapStates(page)).length).toBe(0);
  await expect(page.locator("[data-world-map] svg [data-arc]")).toHaveCount(8);
});
