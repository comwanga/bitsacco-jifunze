import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { accountCopy } from "../lib/account-copy";
import { finishWelcome, freshUser, LANGS, signOut, signUp, submitRecoveryCode } from "./helpers";

// WCAG 2.1 AA, no serious or critical findings, on every account page in its signed-in state,
// at the desktop width and at 360 px.

async function scan(page: Page, label: string): Promise<void> {
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 800 });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(" | ")}`);
    expect(bad, `${label} at ${width}px\n${bad.join("\n")}`).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${label} at ${width}px scrolls sideways`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}

// Each test scans up to seven page states at two widths.
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const lang of LANGS) {
  const c = accountCopy[lang];

  test(`${lang}: sign-in, welcome, account and sign-out pages`, async ({ page }) => {
    await page.goto(`/${lang}/account/signin/`);
    await expect(page.getByRole("main").getByRole("link", { name: c.continueGithub })).toBeVisible();
    await page.getByText(c.useRecoveryCode).click();
    await scan(page, "signin");

    await page.goto(`/${lang}/account/signin/?error=github_denied`);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await scan(page, "signin with an error");

    await page.goto(`/${lang}/account/`);
    await expect(page.getByText(c.signedOut)).toBeVisible();
    await scan(page, "account, signed out");

    await signUp(page, lang, freshUser());
    await scan(page, "welcome with codes");

    await finishWelcome(page, lang);
    await scan(page, "account");

    await page.goto(`/${lang}/account/signout/`);
    await expect(page.getByRole("main").getByRole("button", { name: c.signOut, exact: true })).toBeEnabled();
    await scan(page, "signout");
    await page.getByRole("main").getByRole("button", { name: c.signOut, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: c.signedOutDone })).toBeVisible();
    await scan(page, "signed out");
  });
}

test("recovery page in both languages", async ({ page }) => {
  const codes = await signUp(page, "sw", freshUser());
  await finishWelcome(page, "sw");
  await signOut(page, "sw");
  await submitRecoveryCode(page, "sw", codes[0]!); // one attempt: the page language comes from the path
  await expect(page).toHaveURL(/\/sw\/account\/recovery\/$/);
  for (const lang of LANGS) {
    await page.goto(`/${lang}/account/recovery/`);
    await expect(page.getByRole("heading", { name: accountCopy[lang].replaceHeading })).toBeVisible();
    await scan(page, `${lang} recovery`);
  }
});
