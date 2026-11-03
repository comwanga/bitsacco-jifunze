import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { SIMULATIONS } from "../lib/simulations/registry";
import { simulationCopy } from "../lib/simulations/copy";

function modulePath(id: string) {
  const marker = id === "utxo" ? "UTXO_INTERACTIVE_MODULE" : "CHANNEL_INTERACTIVE_MODULE";
  const root = path.resolve("out/_next/static");
  const file = fs.readdirSync(root, { recursive: true }).find((p) => typeof p === "string" && p.endsWith(".js") && fs.readFileSync(path.join(root, p), "utf8").includes(marker));
  if (typeof file !== "string") throw Error(`No module for ${id}`);
  return `/_next/static/${file.replaceAll("\\", "/")}`;
}

for (const lang of ["en", "sw"] as const) {
  test(`${lang}: lesson → practice → lesson → continue`, async ({ page }) => {
    test.setTimeout(60000);
    const c = simulationCopy[lang];
    await page.goto(`/${lang}/learn/`);
    await expect(page.getByRole("link", { name: c.browse, exact: true })).toBeVisible();
    await page.getByRole("link", { name: c.browse, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.indexTitle);
    for (const entry of SIMULATIONS) {
      for (const key of entry.lessons) {
        await page.goto(`/${lang}/${key}/`);
        await expect(page.locator(`main a[href="/${lang}/simulations/${entry.id}/"]`)).toHaveCount(1);
      }
      const progress = await page.evaluate(() => localStorage.getItem("jifunze:progress:v1"));
      await page.locator(`main a[href="/${lang}/simulations/${entry.id}/"]`).click();
      await page.getByRole("button", { name: c.start, exact: true }).click();
      await expect(page.locator("[data-module]")).toBeVisible();
      await page.getByRole("navigation", { name: c.related, exact: true }).getByRole("link").first().click();
      await expect(page).toHaveURL(new RegExp(`/${lang}/${entry.lessons[0]}/$`));
      expect(await page.evaluate(() => localStorage.getItem("jifunze:progress:v1"))).toBe(progress);
      await expect(page.locator('a[href]').filter({ hasText: lang === "en" ? "Next lesson" : "Somo linalofuata" }).first()).toBeAttached();
    }
  });
  for (const id of ["utxo", "channel-balances"]) {
    test(`${lang}/${id}: activated example reloads and works offline`, async ({ page, context }, info) => {
      test.skip(info.project.name !== "desktop", "service-worker behaviour is shared");
      const c = simulationCopy[lang];
      await page.goto(`/${lang}/simulations/${id}/`);
      await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
      await page.reload();
      await page.getByRole("button", { name: c.start, exact: true }).click();
      await expect(page.locator("[data-module]")).toBeVisible();
      await page.waitForFunction(async (asset) => Boolean(await (await caches.open("static-v1")).match(asset)), modulePath(id));
      await context.setOffline(true);
      await page.reload();
      await page.getByRole("button", { name: c.start, exact: true }).click();
      await expect(page.locator("[data-module]")).toBeVisible();
      await page.getByRole("button", { name: c.reset, exact: true }).click();
      if (id === "utxo") {
        await page.locator('[data-module] input[type="checkbox"]').nth(0).check();
        await page.locator('[data-module] input[type="checkbox"]').nth(1).check();
      }
      await page.getByRole("button", { name: id === "utxo" ? c.build : c.send, exact: true }).click();
      await expect(page.locator('[data-module] [role="status"]')).toContainText(id === "utxo" ? c.built : c.sent);
      await context.setOffline(false);
    });
  }
}

test("uncached interactive module gives an offline explanation and recovers online", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "service-worker behaviour is shared");
  await page.goto("/en/simulations/utxo/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Worked example", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start simulation", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toContainText("could not load");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try loading again", exact: true }).click();
  await expect(page.locator("[data-module]")).toBeVisible();
});
