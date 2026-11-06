import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Include the reproduced failures, a smaller viewport in both languages, and
// non-overflowing desktop tables. Run in Chromium and WebKit, not only Axe.
const CASES = [
  { lang: "sw", width: 393, overflows: true },
  { lang: "en", width: 350, overflows: true },
  { lang: "sw", width: 350, overflows: true },
  { lang: "en", width: 393, overflows: null }, // System font metrics may make this fit or overflow.
  { lang: "sw", width: 320, overflows: true },
  { lang: "en", width: 320, overflows: true },
  { lang: "sw", width: 1280, overflows: false },
  { lang: "en", width: 1280, overflows: false },
] as const;

for (const { lang, width, overflows } of CASES) test(`${lang} ${width}px: lesson table supports native keyboard scrolling and exit`, async ({ page }) => {
  // WebKit's native key events plus a full-page Axe scan exceed 30s on some
  // workstations. Keep every interaction/assertion within a bounded 60s case.
  test.setTimeout(60_000);
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/${lang}/savers/custody-and-fedimint/`);
  await page.evaluate(() => document.fonts.ready);
  const region = page.getByRole("group", { name: lang === "sw" ? "Jedwali la somo" : "Lesson table", exact: true });
  await expect(region).toHaveCount(1);
  const table = region.getByRole("table");
  await expect(table).toHaveCount(1);
  expect(await table.evaluate(t => getComputedStyle(t).display)).toBe("table");
  await expect(table.getByRole("columnheader")).toHaveText(lang === "sw"
    ? ["", "Mtunzaji", "Kujitunzia", "Fedimint"]
    : ["", "Custodial", "Self-custody", "Fedimint"]);
  await expect(table.getByRole("row")).toHaveCount(5);
  await expect(table.locator("thead > tr")).toHaveCount(1);
  await expect(table.locator("tbody > tr")).toHaveCount(4);
  await expect(table.locator("tbody > tr > td:first-child")).toHaveText(lang === "sw"
    ? ["Nani anashika funguo", "Inaweza kuzuiwa", "Ukipoteza simu", "Hatari kuu"]
    : ["Who holds keys", "Can be frozen", "If you lose your phone", "Main risk"]);

  const extent = await region.evaluate(el => el.scrollWidth - el.clientWidth);
  const hasOverflow = extent > 0;
  if (overflows !== null) expect(hasOverflow).toBe(overflows);
  expect(await region.evaluate(el => getComputedStyle(el).overflowX)).toBe("auto");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);

  // Reach the scroll container through real sequential navigation, never .focus().
  let reached = false;
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    if (await region.evaluate(el => document.activeElement === el)) { reached = true; break; }
  }
  expect(reached, "Tab must reach the lesson table's native scroll container").toBe(true);
  await expect(region).toBeFocused();
  expect(await region.evaluate(el => el.matches(":focus-visible"))).toBe(true);
  const outline = await region.evaluate(el => ({ style: getComputedStyle(el).outlineStyle, width: getComputedStyle(el).outlineWidth }));
  expect(outline.style).toBe("solid");
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);

  // A fitting table already exposes both edges; one key tests that case.
  const keyPresses = hasOverflow ? 12 : 1;
  for (let i = 0; i < keyPresses; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(async () => Math.abs(await region.evaluate(el => el.scrollLeft) - extent)).toBeLessThanOrEqual(1);
  if (hasOverflow) {
    expect(await region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    // The last column, including the previously clipped recovery explanation,
    // must be inside the scroll viewport at its right edge.
    expect(await region.evaluate(el => Math.max(...[...el.querySelectorAll("tr > :last-child")].map(cell =>
      cell.getBoundingClientRect().right - el.getBoundingClientRect().right,
    )))).toBeLessThanOrEqual(1);
  }
  for (let i = 0; i < keyPresses; i++) await page.keyboard.press("ArrowLeft");
  await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeLessThanOrEqual(1);
  expect(await region.evaluate(el => Math.min(...[...el.querySelectorAll("tr > :first-child")].map(cell =>
    cell.getBoundingClientRect().left - el.getBoundingClientRect().left,
  )))).toBeGreaterThanOrEqual(-1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);

  await page.keyboard.press("Tab");
  await expect(region).not.toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(region).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(region).not.toBeFocused();

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  expect(axe.violations.filter(v => v.id === "scrollable-region-focusable")).toEqual([]);
});
