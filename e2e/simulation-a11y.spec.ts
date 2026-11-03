import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { simulationCopy } from "../lib/simulations/copy";

async function check(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter((v) => ["serious", "critical"].includes(v.impact!))).toEqual([]);
}
for (const lang of ["en", "sw"] as const) {
  test(`${lang} simulation index accessibility`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "shared semantics; mobile flows covered separately");
    await page.goto(`/${lang}/simulations/`);
    await check(page);
  });
  for (const id of ["utxo", "channel-balances"] as const) for (const colorScheme of ["light", "dark"] as const) {
    test(`${lang}/${id} initial, active and invalid states in ${colorScheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "shared semantics; mobile flows covered separately");
      test.setTimeout(60000);
      const c = simulationCopy[lang];
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(`/${lang}/simulations/${id}/`);
      await check(page);
      await page.getByRole("button", { name: c.start, exact: true }).click();
      await expect(page.locator("[data-module]")).toBeVisible();
      await check(page);
      if (id === "utxo") await page.locator('[data-module] input[type="checkbox"]').first().check();
      await page.getByLabel(c.recipient, { exact: true }).fill("-1");
      await page.getByRole("button", { name: id === "utxo" ? c.build : c.send, exact: true }).click();
      await expect(page.locator('main [role="alert"]')).toBeVisible();
      await check(page);
    });
  }
}
