import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/sw/", "/en/", "/sw/savers/", "/en/savers/", "/sw/savers/wallets-keys/", "/en/savers/wallets-keys/", "/en/lightning/routing-htlcs/", "/sw/glossary/", "/en/glossary/", "/sw/learn/", "/en/learn/"];

for (const path of PAGES) {
  test(`no serious accessibility problems on ${path}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "markup is the same on both projects");
    await page.emulateMedia({ reducedMotion: "reduce" }); // check the settled page, not a frame of the intro
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(" | ")}`);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}
