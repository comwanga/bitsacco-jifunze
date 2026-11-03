import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { simulationCopy } from "../lib/simulations/copy";

function asset(url: string) { return fs.readFileSync(path.join(process.cwd(), "out", decodeURIComponent(new URL(url).pathname)), "utf8"); }

for (const lang of ["sw", "en"] as const) {
  test(`simulation explanations work without JavaScript in ${lang}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const id of ["utxo", "channel-balances"]) {
      await page.goto(`http://localhost:4321/${lang}/simulations/${id}/`);
      await expect(page.getByRole("heading", { name: simulationCopy[lang].workedExample, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: simulationCopy[lang].start, exact: true })).toBeDisabled();
      await expect(page.getByText(simulationCopy[lang].noJs)).toBeVisible();
    }
    await context.close();
  });
  for (const id of ["utxo", "channel-balances"] as const) test(`${lang}/${id} loads only its requested simulation`, async ({ page }) => {
    const scripts = new Set<string>();
    page.on("request", (r) => { if (new URL(r.url()).pathname.endsWith(".js")) scripts.add(r.url()); });
    await page.goto(`/${lang}/simulations/${id}/`);
    const start = page.getByRole("button", { name: simulationCopy[lang].start, exact: true });
    await expect(start).toBeEnabled();
    expect([...scripts].some((url) => /UTXO_INTERACTIVE_MODULE|CHANNEL_INTERACTIVE_MODULE/.test(asset(url)))).toBe(false);
    await start.click();
    await expect(page.locator(`[data-module="${id === "utxo" ? "UTXO" : "CHANNEL"}_INTERACTIVE_MODULE"]`)).toBeVisible();
    expect([...scripts].some((url) => asset(url).includes(id === "utxo" ? "CHANNEL_INTERACTIVE_MODULE" : "UTXO_INTERACTIVE_MODULE"))).toBe(false);
    await page.locator(`header a[hreflang="${lang === "sw" ? "en" : "sw"}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${lang === "sw" ? "en" : "sw"}/simulations/${id}/$`));
  });
}

test("a failed interactive download keeps the explanation and can retry", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  let fail = true;
  await page.route("**/_next/static/**/*.js", async (route) => {
    if (fail && asset(route.request().url()).includes("UTXO_INTERACTIVE_MODULE")) await route.abort();
    else await route.continue();
  });
  await page.goto("http://localhost:4321/en/simulations/utxo/");
  await page.getByRole("button", { name: "Start simulation", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toContainText("could not load");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact!))).toEqual([]);
  await expect(page.getByRole("heading", { name: "Worked example", exact: true })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try loading again", exact: true }).click();
  await expect(page.locator('[data-module="UTXO_INTERACTIVE_MODULE"]')).toBeVisible();
  await context.close();
});
