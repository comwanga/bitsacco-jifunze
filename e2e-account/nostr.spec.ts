import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { accountCopy } from "../lib/account-copy";
import { nostrOnboardingCopy } from "../lib/nostr-onboarding-copy";
import { signedEvent } from "../api/test/nostr-helper";
import { finishWelcome, LANGS, SESSION_COOKIE, signOut, submitRecoveryCode, whoAmI } from "./helpers";

// One recovery redemption here plus four in the existing suite: stay within the real five-attempt limit.
test.describe.configure({ retries: 0 });

async function signer(page: Page, mode = "approve") {
  const key = randomBytes(32);
  const pubkey = signedEvent(new Uint8Array(), "", undefined, {}, [], key).pubkey;
  let calls = 0;
  await page.exposeFunction("fakeNostrSign", async (event: { created_at: number }) => {
    calls++;
    if (mode === "decline") throw new Error("User rejected the request");
    if (mode === "error") throw new Error("Signer disconnected");
    if (mode === "pending") await new Promise((r) => setTimeout(r, 1000));
    const signed = signedEvent(new Uint8Array(), "", event.created_at, event, [], key);
    if (mode === "invalid") signed.sig = "0".repeat(128);
    if (mode === "extra") Object.assign(signed, { nsec: "fixture-secret-never-forward" });
    return signed;
  });
  await page.addInitScript((pubkey) => {
    Object.assign(window, { nostr: { getPublicKey: async () => pubkey, signEvent: (e: unknown) => (window as unknown as { fakeNostrSign: (e: unknown) => Promise<unknown> }).fakeNostrSign(e) } });
  }, pubkey);
  return () => calls;
}

for (const lang of LANGS) {
  const c = { ...accountCopy[lang], ...nostrOnboardingCopy[lang] };
  test(`${lang}: beginner onboarding explains self-custody without collecting keys`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) requests.push(r.url()); });
    await page.goto(`/${lang}/account/signin/`);
    const existing = page.getByRole("radio", { name: c.nostrExisting });
    await expect(existing).toBeChecked();
    await existing.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: c.nostrNew })).toBeChecked();
    await expect(page.getByText(c.nostrIntro)).toBeVisible();
    await expect(page.getByText(c.nostrPublicHelp)).toBeVisible();
    await expect(page.getByText(c.nostrLossHelp)).toBeVisible();
    await expect(page.getByRole("link", { name: c.nostrGuide })).toHaveAttribute("href", "https://guides.getalby.com/user-guide/browser-extension/features/nostr");
    await expect(page.getByRole("link", { name: c.nostrBackupGuide })).toHaveAttribute("rel", "noopener noreferrer");
    expect(await page.locator('input:not([type="radio"])').count()).toBe(1); // existing recovery code only
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].some((k) => /nostr|nsec/i.test(k)))).toBe(false);
    await page.setViewportSize({ width: 360, height: 800 });
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.getByRole("radio", { name: c.nostrExisting }).check();
    await expect(page.getByText(c.nostrIntro)).toHaveCount(0);
    await page.evaluate(() => Object.assign(window, { nostr: { signEvent: async () => null } }));
    await page.getByRole("button", { name: c.nostrCheckSigner }).click();
    await expect(page.getByRole("button", { name: c.continueNostr })).toBeEnabled();
  });
  test(`${lang}: no signer has an accessible fallback and keeps GitHub and recovery available`, async ({ page, context }) => {
    await page.goto(`/${lang}/account/signin/`);
    await expect(page.getByText(c.nostrNoSigner)).toBeVisible();
    await expect(page.getByRole("button", { name: c.continueNostr })).toBeDisabled();
    await expect(page.getByRole("link", { name: c.continueGithub })).toBeVisible();
    await expect(page.getByText(c.useRecoveryCode)).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  });

  test(`${lang}: real signed fake NIP-07 login, recovery codes once, returning account and recovery scope`, async ({ page, context }) => {
    const calls = await signer(page);
    await page.goto(`/${lang}/account/signin/`);
    const seen: string[] = [];
    page.on("request", (r) => seen.push(r.url()));
    await page.getByRole("button", { name: c.continueNostr }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/welcome/$`));
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    const codes = await page.locator("[data-codes] li").allTextContents();
    const initial = await whoAmI(page);
    expect(initial.scope).toBe("full");
    await expect(page.getByText(c.nostrWelcomeLead)).toBeVisible();
    await finishWelcome(page, lang);
    await expect(page.locator("[data-nostr-pubkey]")).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByText(c.nostrCodesHelp)).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(seen.some((u) => u.startsWith("wss:"))).toBe(false);
    await signOut(page, lang);
    await page.goto(`/${lang}/account/signin/`);
    await page.getByRole("button", { name: c.continueNostr }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/$`));
    expect((await whoAmI(page)).id).toBe(initial.id);
    expect(calls()).toBe(2);
    const issue = await page.evaluate(async () => (await fetch("/api/me/recovery-codes/initial", { method: "POST", headers: { "X-Jifunze": "1" } })).status);
    expect(issue).toBe(409);
    if (lang === "sw") {
      await signOut(page, lang);
      await submitRecoveryCode(page, lang, codes[0]!);
      await expect(page).toHaveURL(new RegExp(`/${lang}/account/recovery/$`));
      expect((await whoAmI(page)).id).toBe(initial.id);
      expect((await whoAmI(page)).scope).toBe("recovery");
      for (const recoveryLang of LANGS) {
        await page.goto(`/${recoveryLang}/account/recovery/`);
        await expect(page.getByText(accountCopy[recoveryLang].error_nostr_lifecycle_pending)).toBeVisible();
        await expect(page.getByRole("link", { name: c.replaceGithub })).toHaveCount(0);
      }
    }
    expect((await context.cookies()).find((c) => c.name === SESSION_COOKIE)?.httpOnly).toBe(true);
  });

  for (const mode of ["decline", "error", "invalid", "expired"]) {
    test(`${lang}: ${mode} announces failure without creating a session`, async ({ page, context }) => {
      await signer(page, mode);
      if (mode === "expired") await page.clock.setFixedTime(new Date(Date.now() - 61_000));
      await page.goto(`/${lang}/account/signin/`);
      await page.getByRole("button", { name: c.continueNostr }).click();
      const text = mode === "decline" ? c.nostrDeclined : mode === "invalid" ? c.error_nostr_invalid : mode === "expired" ? c.error_nostr_expired : c.nostrFailed;
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(text);
      await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
      expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
      await expect(page.getByRole("button", { name: c.continueNostr })).toBeEnabled();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    });
  }

  test(`${lang}: connection failure keeps sign-in available without creating a session`, async ({ page, context }) => {
    await signer(page);
    await page.route("**/api/auth/nostr/challenge", (route) => route.abort("connectionfailed"));
    await page.goto(`/${lang}/account/signin/`);
    await page.getByRole("button", { name: c.continueNostr }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.error_network);
    await expect(page.getByRole("button", { name: c.continueNostr })).toBeEnabled();
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
  });

  test(`${lang}: duplicate activation requests only one signature and exposes pending status`, async ({ page }) => {
    const calls = await signer(page, "pending");
    await page.goto(`/${lang}/account/signin/`);
    const button = page.getByRole("button", { name: c.continueNostr });
    await button.evaluate((el) => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
    await expect(page.getByRole("status").filter({ hasText: c.nostrPending })).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/welcome/$`));
    expect(calls()).toBe(1);
  });
}

test("only public event fields are sent even if a signer returns an unexpected property", async ({ page }) => {
  await signer(page, "extra");
  await page.goto("/en/account/signin/");
  const request = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/auth/nostr/verify");
  await page.getByRole("button", { name: accountCopy.en.continueNostr }).click();
  const authorization = (await request).headers().authorization!;
  const proof = JSON.parse(Buffer.from(authorization.slice(6), "base64").toString("utf8"));
  expect(Object.keys(proof).sort()).toEqual(["id", "pubkey", "sig", "created_at", "kind", "tags", "content"].sort());
  expect(proof.nsec).toBeUndefined();
  await expect(page).toHaveURL(/\/en\/account\/welcome\/$/);
});
