import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { simulationCopy } from "../lib/simulations/copy";
import { savingsCopy } from "../lib/simulations/savings-copy";

for (const lang of ["en", "sw"] as const) {
  test(`${lang}: fictional scenario responds to shocks, costs, unavailable resources and invalid input`, async ({ page, context }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 360, height: 800 });
    const writes: string[] = [];
    page.on("request", (r) => { if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url()); });
    await page.goto(`/${lang}/simulations/savings-scenarios/`);
    await page.getByRole("button", { name: simulationCopy[lang].start, exact: true }).click();
    const sim = page.locator('[data-module="SAVINGS_INTERACTIVE_MODULE"]');
    const c = savingsCopy[lang];
    await sim.getByRole("button", { name: c.calculate }).focus(); await page.keyboard.press("Enter");
    await expect(sim.getByRole("status")).toContainText("-3,200.00");
    await sim.getByLabel(c.preset, { exact: true }).selectOption("community");
    await sim.getByRole("button", { name: c.calculate }).click();
    await expect(sim.getByRole("status")).toContainText("4,000.00");
    await sim.getByRole("checkbox").uncheck();
    await sim.getByRole("button", { name: c.calculate }).click();
    await expect(sim.getByRole("status")).toContainText("-10,000.00");
    await sim.getByLabel(c.cash, { exact: true }).fill("-1");
    await sim.getByRole("button", { name: c.calculate }).click();
    await expect(sim.getByRole("alert")).toHaveText(c.invalid);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await sim.getByRole("button", { name: c.reset }).click();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.reload();
    await page.getByRole("button", { name: simulationCopy[lang].start, exact: true }).click();
    await context.setOffline(true); await page.reload();
    await page.getByRole("button", { name: simulationCopy[lang].start, exact: true }).click();
    await page.locator('[data-module="SAVINGS_INTERACTIVE_MODULE"]').getByRole("button", { name: c.calculate }).click();
    await expect(page.locator('[data-module="SAVINGS_INTERACTIVE_MODULE"]').getByRole("status")).toContainText("-3,200.00");
    expect(writes).toEqual([]);
    await context.setOffline(false);
  });

  test(`${lang}: savings assumptions and worked example are readable without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
    await page.goto(`/${lang}/simulations/savings-scenarios/`);
    await expect(page.getByRole("heading", { name: simulationCopy[lang].workedExample, exact: true })).toBeVisible();
    await expect(page.getByText(savingsCopy[lang].limits, { exact: true })).toBeVisible();
    await context.close();
  });
}
