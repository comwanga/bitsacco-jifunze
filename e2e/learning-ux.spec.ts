import { expect, test } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";

for (const lang of ["en", "sw"] as const) {
  test(`${lang}: continuation uses full metadata estimate and preserves incomplete progress`, async ({ page }, info) => {
    const at = "2026-11-01T10:00:00.000Z";
    const progress = { app: "bitsacco-jifunze", version: 1, lessons: {
      "savers/money-and-bitcoin": { completedAt: at },
      "savers/sats-and-volatility": { quiz: { correct: 1, total: 4, at }, reflectedAt: at },
    } };
    await page.goto(`/${lang}/progress/`);
    await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(progress)) });
    await page.locator("header [data-brand]").click();
    const card = page.locator("[data-continue]");
    await expect(card).toContainText(lang === "en" ? "Sats, prices and volatility: saving in Bitcoin vs shillings" : "Sats, bei na kupanda na kushuka: kuweka akiba kwa Bitcoin na kwa shilingi");
    const duration = /^minutes: (\d+)$/m.exec(fs.readFileSync(`content/savers/${lang}/sats-and-volatility.mdx`, "utf8"))![1];
    await expect(card).toContainText(lang === "en" ? `Full lesson estimate: ${duration} minutes.` : `Makadirio ya somo zima: dakika ${duration}.`);
    await expect(card).toContainText(lang === "en" ? "You're making progress! Keep going." : "Unaendelea vizuri! Endelea hivyo.");
    const next = card.getByRole("link", { name: lang === "en" ? "Continue learning" : "Endelea kujifunza" });
    await expect(next).toHaveAttribute("href", `/${lang}/savers/sats-and-volatility/`);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!)) ).toEqual(progress);
    await page.reload();
    await expect(card).toContainText(lang === "en" ? "Full lesson estimate" : "Makadirio ya somo zima");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const result = await new AxeBuilder({ page }).include("[data-continue]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await card.screenshot({ path: info.outputPath("continue-learning.png") });
  });

  test(`${lang}: Tree is default; explicit List survives lesson navigation, reload and back`, async ({ page }) => {
    const tree = lang === "en" ? "Tree" : "Mti";
    const list = lang === "en" ? "List" : "Orodha";
    for (const id of ["savers", "lightning", "builders"]) {
      await page.goto(`/${lang}/${id}/`);
      await expect(page.getByRole("link", { name: tree, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".learning-tree").first()).toBeVisible();
    }
    await page.getByRole("link", { name: list, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${lang}/list/builders/$`));
    await expect(page.getByRole("link", { name: list, exact: true })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page.getByRole("link", { name: list, exact: true })).toHaveAttribute("aria-current", "page");
    await page.locator('main a[href="/' + lang + '/builders/dev-environment-regtest/"]').first().click();
    await page.locator('article a[href="/' + lang + '/builders/"]').click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/list/builders/$`));
    await expect(page.getByRole("link", { name: list, exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: tree, exact: true }).click();
    await expect(page.locator(".learning-tree").first()).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("link", { name: list, exact: true })).toHaveAttribute("aria-current", "page");
  });
}

test("both path views work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const lang of ["en", "sw"]) for (const id of ["savers", "builders", "lightning"]) {
    await page.goto(`/${lang}/${id}/`);
    await expect(page.locator(".learning-tree").first()).toBeVisible();
    await page.getByRole("link", { name: lang === "en" ? "List" : "Orodha", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/list/${id}/$`));
    await expect(page.locator(".learning-tree")).toHaveCount(0);
    await expect(page.getByRole("link", { name: lang === "en" ? "List" : "Orodha", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: lang === "en" ? "Tree" : "Mti", exact: true }).click();
    await expect(page.locator(".learning-tree").first()).toBeVisible();
  }
  await context.close();
});

test("missing, corrupt and fully completed progress never offers a completed lesson", async ({ page }) => {
  const lessons = Object.fromEntries(["savers", "builders", "lightning"].flatMap(id => fs.readdirSync(`content/${id}/en`).filter(f => f.endsWith(".mdx")).map(f => [`${id}/${f.slice(0, -4)}`, { completedAt: "2026-11-01T10:00:00Z" }])));
  for (const raw of [null, "{bad", JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": {} } }), JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons })]) {
    await page.goto("/en/");
    await page.evaluate(raw => raw === null ? localStorage.removeItem("jifunze:progress:v1") : localStorage.setItem("jifunze:progress:v1", raw), raw);
    await page.reload();
    await expect(page.locator("[data-continue]")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("jifunze:progress:v1"))).toBe(raw);
  }
});
