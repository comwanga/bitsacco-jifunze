import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { simulationCopy } from "../lib/simulations/copy";
import { scriptGzip, trackScripts } from "./helpers/script-budget";
import { UX_LIMITS } from "../lib/build/ux-budget";

for (const lang of ["en", "sw"] as const) for (const id of ["utxo", "channel-balances"] as const) {
  test(`${lang}/${id}: actual initial and activated script budgets`, async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop", "both projects download the same JavaScript assets");
    const scripts = trackScripts(context);
    await page.goto(`/${lang}/simulations/${id}/`);
    await expect(page.getByRole("button", { name: simulationCopy[lang].start, exact: true })).toBeEnabled();
    await page.waitForLoadState("networkidle");
    const initial = new Set(scripts);
    await page.getByRole("button", { name: simulationCopy[lang].start, exact: true }).click();
    await expect(page.locator("[data-module]")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const extra = [...scripts].filter((p) => !initial.has(p));
    const sizes = { initial: scriptGzip(initial) / 1024, activated: scriptGzip(scripts) / 1024, extra: scriptGzip(extra) / 1024 };
    fs.writeFileSync(info.outputPath("script-budget.json"), JSON.stringify({ lang, id, sizes, initial: [...initial], extra }, null, 2));
    console.log(`${lang}/${id} requested JS gzip KB: ${JSON.stringify(sizes)}`);
    expect(sizes.initial).toBeLessThanOrEqual(UX_LIMITS.simulation);
    expect(sizes.activated).toBeLessThanOrEqual(UX_LIMITS.activated);
    expect(sizes.extra).toBeLessThanOrEqual(UX_LIMITS.extra);
    expect(extra.length).toBeGreaterThan(0);
  });
}
