import { expect, test } from "@playwright/test";
import { simulationCopy } from "../lib/simulations/copy";

for (const lang of ["en", "sw"] as const) for (const id of ["utxo", "channel-balances"]) {
  test(`${lang}/${id}: keyboard or touch at 360px with blocked storage`, async ({ page, context }, info) => {
    const c = simulationCopy[lang];
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } }));
    const writes: string[] = [];
    context.on("request", (r) => { if (!["GET", "HEAD"].includes(r.method()) || new URL(r.url()).port === "7777") writes.push(r.url()); });
    await page.goto(`/${lang}/simulations/${id}/`);
    const start = page.getByRole("button", { name: c.start, exact: true });
    if (info.project.name === "mobile") await start.tap();
    else { await start.focus(); await page.keyboard.press("Enter"); }
    await expect(page.getByRole("heading", { name: c.practice, exact: true })).toBeFocused();
    const sim = page.locator("[data-module]");
    if (id === "utxo") {
      if (info.project.name === "mobile") { await sim.getByRole("checkbox").nth(0).tap(); await sim.getByRole("checkbox").nth(1).tap(); }
      else {
        await page.keyboard.press("Tab"); await expect(sim.getByRole("checkbox").nth(0)).toBeFocused(); await page.keyboard.press("Space");
        await page.keyboard.press("Tab"); await page.keyboard.press("Space");
      }
      await expect(sim.getByRole("checkbox").nth(1)).toBeChecked();
    } else {
      if (info.project.name === "mobile") await sim.getByRole("radio", { name: c.bobToAlice, exact: true }).tap();
      else { await page.keyboard.press("Tab"); await page.keyboard.press("ArrowRight"); }
      await expect(sim.getByRole("radio", { name: c.bobToAlice, exact: true })).toBeChecked();
    }
    const action = sim.getByRole("button", { name: id === "utxo" ? c.build : c.send, exact: true });
    if (info.project.name === "mobile") await action.tap();
    else { await action.focus(); await page.keyboard.press("Enter"); }
    await expect(sim.getByRole("status")).toContainText(id === "utxo" ? c.built : c.sent);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await sim.getByRole("button", { name: c.reset, exact: true }).click();
    await expect(sim.getByRole("status")).toHaveText(c.resetDone);
    expect(writes).toEqual([]);
  });
}

test("native tree links support keyboard navigation between views and lessons", async ({ page }) => {
  await page.goto("/en/tree/builders/");
  await expect(page.getByRole("tree")).toHaveCount(0);
  await page.getByRole("link", { name: "List", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/builders\/$/);
  await page.getByRole("link", { name: "Tree", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/tree\/builders\/$/);
  await page.locator("[data-tree-lesson] h3 a").first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/builders\/dev-environment-regtest\/$/);
});
