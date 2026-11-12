import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { connect } from "../api/src/db";
import { signedEvent } from "../api/test/nostr-helper";
import { approve, continueWithGithub, finishWelcome, freshUser, LANGS, SESSION_COOKIE, signOut, signUp, submitRecoveryCode, whoAmI } from "../e2e-account/helpers";
import { accountCopy } from "../lib/account-copy";
import { pubkeyOf, TESTERS } from "./testers";

// The identities are fixed because the API's list is, so each run starts without their accounts.
test.beforeAll(async () => {
  const sql = connect(process.env.TEST_DATABASE_URL!);
  const uids = Object.values(TESTERS).flatMap((t) => [String(t.github.id), pubkeyOf(t.nostrKey)]);
  await sql`delete from accounts where id in (select account_id from identities where provider_uid in ${sql(uids)})`;
  await sql.end({ timeout: 5 });
});

/** A browser signer that really signs with the given key. */
async function signer(page: Page, key: Uint8Array, mode: "approve" | "invalid" = "approve") {
  const k = key as typeof TESTERS.sw.nostrKey;
  await page.exposeFunction("fakeNostrSign", async (event: { created_at: number }) => {
    const signed = signedEvent(new Uint8Array(), "", event.created_at, event, [], k);
    if (mode === "invalid") signed.sig = "0".repeat(128);
    return signed;
  });
  await page.addInitScript((pubkey) => {
    Object.assign(window, { nostr: { getPublicKey: async () => pubkey, signEvent: (e: unknown) => (window as unknown as { fakeNostrSign: (e: unknown) => Promise<unknown> }).fakeNostrSign(e) } });
  }, pubkeyOf(key));
}

const hasSession = async (context: BrowserContext) => (await context.cookies()).some((c) => c.name === SESSION_COOKIE);

test("a generated learning identity is denied by the tester allowlist", async ({ page, context }) => {
  await page.goto("/en/account/signin/");
  await page.locator("[data-save-progress]").click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(accountCopy.en.error_challenge_invalid);
  expect(await hasSession(context)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("jifunze:identity:v1"))).toMatch(/^[0-9a-f]{64}$/);
});

for (const lang of LANGS) {
  const c = accountCopy[lang];
  const tester = TESTERS[lang];
  const alert = (page: Page) => page.getByRole("main").getByRole("alert");

  test(`${lang}: a listed GitHub identity signs up, returns, recovers and cannot replace itself with an unlisted one`, async ({ page }) => {
    const codes = await signUp(page, lang, tester.github);
    await finishWelcome(page, lang);
    const account = await whoAmI(page);
    await signOut(page, lang);

    await continueWithGithub(page, lang, tester.github);
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/$`));
    expect((await whoAmI(page)).id).toBe(account.id);
    await signOut(page, lang);

    await submitRecoveryCode(page, lang, codes[0]!);
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/recovery/$`));
    expect(await whoAmI(page)).toMatchObject({ id: account.id, scope: "recovery" });

    await page.getByRole("main").getByRole("link", { name: c.replaceGithub }).click();
    await approve(page, freshUser());
    await expect(alert(page)).toHaveText(c.error_state_invalid);
    expect(await whoAmI(page)).toMatchObject({ id: account.id, handle: tester.github.login, scope: "recovery" });
  });

  test(`${lang}: an unlisted GitHub identity gets the stale-request message and no session`, async ({ page, context }) => {
    await continueWithGithub(page, lang, freshUser());
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/signin/`));
    await expect(alert(page)).toHaveText(c.error_state_invalid);
    expect(await hasSession(context)).toBe(false);
    await expect(page.getByRole("main").getByRole("link", { name: c.continueGithub })).toBeVisible();
  });

  test(`${lang}: a listed Nostr identity signs up and returns to the same account`, async ({ page }) => {
    await signer(page, tester.nostrKey);
    await page.goto(`/${lang}/account/signin/#own`);
    await page.getByRole("button", { name: c.continueNostr }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/welcome/$`));
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    await finishWelcome(page, lang);
    const account = await whoAmI(page);
    await signOut(page, lang);

    await page.goto(`/${lang}/account/signin/#own`);
    await page.getByRole("button", { name: c.continueNostr }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/$`));
    expect((await whoAmI(page)).id).toBe(account.id);
  });

  test(`${lang}: an unlisted Nostr identity with a valid signature gets the spent-challenge message and no session`, async ({ page, context }) => {
    await signer(page, new Uint8Array(randomBytes(32)));
    await page.goto(`/${lang}/account/signin/#own`);
    await page.getByRole("button", { name: c.continueNostr }).click();
    await expect(alert(page)).toHaveText(c.error_challenge_invalid);
    expect(await hasSession(context)).toBe(false);
    await expect(page.getByRole("button", { name: c.continueNostr })).toBeEnabled();
  });

  test(`${lang}: a listed Nostr key with an invalid signature is refused`, async ({ page, context }) => {
    await signer(page, tester.nostrKey, "invalid");
    await page.goto(`/${lang}/account/signin/#own`);
    await page.getByRole("button", { name: c.continueNostr }).click();
    await expect(alert(page)).toHaveText(c.error_nostr_invalid);
    expect(await hasSession(context)).toBe(false);
  });

  test(`${lang}: a wrong recovery code is refused with its usual message`, async ({ page, context }) => {
    await submitRecoveryCode(page, lang, "AAAA-AAAA-AAAA-AAAA");
    await expect(alert(page)).toHaveText(c.error_recovery_invalid);
    expect(await hasSession(context)).toBe(false);
  });
}
