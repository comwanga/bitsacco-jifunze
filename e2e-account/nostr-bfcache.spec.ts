import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { accountCopy } from "../lib/account-copy";
import { signedEvent } from "../api/test/nostr-helper";
import { LANGS, whoAmI } from "./helpers";

// Uses the real account API/PostgreSQL, with a fake signer producing valid Schnorr signatures.
// Do not use page.route: interception disables browser caching and can hide this regression.
async function signer(page: Page, approval: Promise<void> = Promise.resolve()) {
  const key = randomBytes(32);
  const pubkey = signedEvent(new Uint8Array(), "", undefined, {}, [], key).pubkey;
  let calls = 0;
  await page.exposeFunction("bfcacheSign", async (event: { created_at: number }) => {
    calls++;
    await approval;
    return signedEvent(new Uint8Array(), "", event.created_at, event, [], key);
  });
  await page.addInitScript((pubkey) => {
    const state = { documentId: crypto.randomUUID(), restores: 0 };
    window.addEventListener("pageshow", (event) => { if (event.persisted) state.restores++; });
    Object.assign(window, {
      nostrCacheTest: state,
      nostr: {
        getPublicKey: async () => pubkey,
        signEvent: (event: unknown) => (window as unknown as { bfcacheSign: (event: unknown) => Promise<unknown> }).bfcacheSign(event),
      },
    });
  }, pubkey);
  return () => calls;
}

const cacheState = (page: Page) => page.evaluate(() =>
  (window as unknown as { nostrCacheTest: { documentId: string; restores: number } }).nostrCacheTest);

for (const lang of LANGS) {
  const c = accountCopy[lang];
  test(`${lang}: successful Nostr sign-in restores from BFCache and can sign in again`, async ({ page }) => {
    const calls = await signer(page);
    let challenges = 0;
    page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/auth/nostr/challenge") challenges++; });
    await page.goto(`/${lang}/account/signin/`);
    const original = await cacheState(page);
    const button = page.getByRole("button", { name: c.continueNostr, exact: true });
    await button.click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/welcome/$`));
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    const account = await whoAmI(page);

    await page.goBack({ waitUntil: "commit" });
    await expect(button).toBeVisible();
    // Both assertions fail on a reload: this must be the original document, restored by the browser.
    await expect.poll(() => cacheState(page)).toEqual({ documentId: original.documentId, restores: 1 });
    await test.info().attach("browser-cache-restoration", {
      body: Buffer.from(JSON.stringify({ commit: process.env.JIFUNZE_TEST_COMMIT ?? "unrecorded", lang, original, restored: await cacheState(page) })),
      contentType: "application/json",
    });
    await expect(button).toBeEnabled();
    await expect.soft(page.getByRole("main").getByRole("status")).toHaveText("");
    await button.click();
    await expect.poll(calls).toBe(2);
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/$`));
    expect(challenges).toBe(2);
    expect((await whoAmI(page)).id).toBe(account.id);
  });

  test(`${lang}: pending signing stays locked, including after BFCache restoration`, async ({ page }) => {
    let approve!: () => void;
    const approval = new Promise<void>((resolve) => { approve = resolve; });
    const calls = await signer(page, approval);
    let challenges = 0;
    page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/auth/nostr/challenge") challenges++; });
    await page.goto(`/${lang}/account/signin/`);
    const original = await cacheState(page);
    const button = page.getByRole("button", { name: c.continueNostr, exact: true });
    await expect(button).toBeEnabled();
    await button.evaluate((element) => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
    try {
      await expect.poll(calls).toBe(1);
      await expect(button).toBeDisabled();
      await expect(page.getByRole("main").getByRole("link", { name: c.continueGithub })).toHaveAttribute("aria-disabled", "true");
      await page.getByText(c.useRecoveryCode).click();
      await expect(page.locator('form button[type="submit"]')).toBeDisabled();
      await expect(page.getByRole("status").filter({ hasText: c.nostrPending })).toBeVisible();
      expect(challenges).toBe(1);
      expect(calls()).toBe(1);
      // A real restore must not unlock a signer request that has not finished.
      await page.evaluate((path) => window.location.assign(path), `/${lang}/`);
      await page.waitForURL(new RegExp(`/${lang}/$`));
      await page.goBack({ waitUntil: "commit" });
      await expect.poll(() => cacheState(page)).toEqual({ documentId: original.documentId, restores: 1 });
      await expect(button).toBeDisabled();
      await expect(page.getByRole("main").getByRole("link", { name: c.continueGithub })).toHaveAttribute("aria-disabled", "true");
      await expect(page.locator('form button[type="submit"]')).toBeDisabled();
      expect(challenges).toBe(1);
      expect(calls()).toBe(1);
      await test.info().attach("pending-browser-cache-restoration", {
        body: Buffer.from(JSON.stringify({ commit: process.env.JIFUNZE_TEST_COMMIT ?? "unrecorded", lang, original, restored: await cacheState(page), calls: calls(), challenges })),
        contentType: "application/json",
      });
    } finally { approve(); }
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/welcome/$`));
  });
}
