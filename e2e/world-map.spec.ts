import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { getWorldGroups } from "../lib/content/load.ts";
import { MAP, MAP_HEIGHT, project } from "../lib/map/project.ts";

test("the generated map matches the projection the markers use", () => {
  const svg = fs.readFileSync("public/images/world-dots.svg", "utf8");
  expect(/viewBox="([^"]+)"/.exec(svg)?.[1]).toBe(`0 0 ${MAP.width} ${MAP_HEIGHT.toFixed(1)}`);
  const dots = [...svg.matchAll(/M([\d.]+) ([\d.]+)h0/g)].map((m) => ({ x: +m[1], y: +m[2] }));
  expect(dots.length).toBeGreaterThan(1000);
  // Every dot is a projected point of the generator's 3° lattice (cell centres from 84°N and 180°W).
  const lattice = new Set<string>();
  for (let lat = MAP.latTop - 1.5; lat >= MAP.latBottom; lat -= 3)
    for (let lon = -178.5; lon < 180; lon += 3) {
      const p = project(lat, lon);
      lattice.add(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    }
  const off = dots.filter((d) => !lattice.has(`${d.x.toFixed(1)} ${d.y.toFixed(1)}`));
  expect(off.length, `${off.length} dots are not on the projected lattice`).toBe(0);
  // Markers sit on land.
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

test("the map renders offline in a new tab after a single visit", async ({ page, context }) => {
  await page.goto("/sw/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await context.setOffline(true);
  const fresh = await context.newPage();
  await fresh.goto("/en/");
  const img = fresh.locator("[data-world-map] img");
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
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

test("the map skips rendering work while it is off-screen", async ({ page }) => {
  await page.goto("/en/");
  const style = await page.locator("[data-world-map]").evaluate((el) => {
    const s = getComputedStyle(el);
    return { visibility: s.contentVisibility, size: s.containIntrinsicSize };
  });
  expect(style.visibility).toBe("auto");
  expect(style.size).toContain("auto");
});
