import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signedEvent } from "../api/test/nostr-helper";
import { accountCopy } from "../lib/account-copy";
import { accountSecurityCopy } from "../lib/account-security-copy";
import { learningIdentityCopy } from "../lib/learning-identity-copy";
import { syncCopy } from "../lib/sync-copy";
import { discussionCopy } from "../lib/discussion-copy";
import { t } from "../lib/i18n";
import { finishWelcome, submitRecoveryCode, whoAmI } from "../e2e-account/helpers";

const PROGRESS = "jifunze:progress:v1";

test("recovery inputs mask codes and never forward private-key or seed-shaped text", async ({ page }) => {
  for (const lang of ["en", "sw"] as const) {
    const c = accountCopy[lang];
    const requests: string[] = [];
    const track = (r: import("@playwright/test").Request) => { if (r.url().includes("/api/")) requests.push(r.url()); };
    page.on("request", track);
    await page.goto(`/${lang}/account/signin/#own`);
    await page.getByText(c.useRecoveryCode).click();
    const input = page.getByLabel(c.recoveryCodeLabel);
    await expect(input).toHaveAttribute("type", "password");
    for (const text of ["nsec1fixture-not-a-real-key", "fixture seed words never belong here"]) {
      await input.fill(text);
      await page.getByRole("button", { name: c.recoveryCodeSubmit }).click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.error_recovery_invalid);
      await expect(input).toBeFocused();
      await expect(input).toHaveValue("");
    }
    expect(requests).toEqual([]);
    page.off("request", track);
  }
});

const key = () => new Uint8Array(randomBytes(32));
async function signer(page: Page) {
  let current = key(), mode = "approve";
  let calls = 0;
  await page.exposeFunction("lifecycleSign", async (event: { created_at: number }) => {
    calls++;
    if (mode === "decline") throw new Error("User rejected request");
    const signed = signedEvent(new Uint8Array(), "", event.created_at, event, [], current);
    // The client must never forward arbitrary fields even if an extension returns them.
    return { ...signed, nsec: "fixture-never-forward" };
  });
  await page.addInitScript(() => Object.assign(window, { nostr: { signEvent: (event: unknown) =>
    (window as unknown as { lifecycleSign: (event: unknown) => Promise<unknown> }).lifecycleSign(event) } }));
  return { use: (next: ReturnType<typeof key>) => { current = next; }, mode: (next: string) => { mode = next; }, key: () => current, calls: () => calls };
}
async function signup(page: Page, lang: "en" | "sw") {
  await page.goto(`/${lang}/account/signin/#own`);
  await page.getByRole("button", { name: accountCopy[lang].continueNostr }).click();
  const codes = page.locator("[data-codes] li");
  await expect(codes).toHaveCount(10);
  const initial = await codes.allTextContents();
  await finishWelcome(page, lang);
  await expect(page.locator("[data-progress-sync]")).toHaveAttribute("data-progress-sync", "mine:synced");
  return initial;
}
const apiStatus = (page: Page, route = "/api/me") => page.evaluate(async (path) => (await fetch(path, { cache: "no-store" })).status, route);
async function complete(page: Page, lang: "en" | "sw") {
  await page.goto(`/${lang}/savers/money-and-bitcoin/`);
  await page.getByRole("button", { name: discussionCopy[lang].confirm, exact: true }).click();
  await page.getByRole("button", { name: t(lang, "markComplete"), exact: true }).click();
  await expect(page.locator("[data-progress-status]")).toHaveText(syncCopy[lang].syncSaved, { timeout: 15_000 });
}
async function accessible(page: Page) {
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("mobile-confirmation.png"), fullPage: true });
}

for (const lang of ["en", "sw"] as const) {
  const c = accountCopy[lang], s = accountSecurityCopy[lang];
  test(`${lang}: reauthentication, code regeneration and lost-key recovery preserve the account and rotate secrets`, async ({ page, context, browser }) => {
    test.setTimeout(90_000);
    const signing = await signer(page), originalKey = signing.key();
    const originalCodes = await signup(page, lang);
    const original = await whoAmI(page);
    await complete(page, lang);
    await page.goto(`/${lang}/account/`);
    const proofs: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/auth\/nostr\/(reauth|replace)$/.test(r.url())) proofs.push(Buffer.from(r.headers().authorization?.slice(6) ?? "", "base64").toString("utf8"));
    });
    await expect(page.getByRole("button", { name: c.newCodes, exact: true })).toBeEnabled();
    await page.getByRole("button", { name: c.newCodes, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(s.reauthHelp)).toBeVisible();
    signing.mode("decline");
    await page.getByRole("button", { name: s.reauth, exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(s.declined);
    await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
    signing.mode("approve"); signing.use(key());
    await page.getByRole("button", { name: s.reauth, exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.error_nostr_key_mismatch);
    await expect(page.getByRole("button", { name: c.newCodesConfirm })).toHaveCount(0);
    signing.use(originalKey);
    await page.clock.setFixedTime(new Date(Date.now() - 61_000));
    await page.getByRole("button", { name: s.reauth, exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.error_nostr_expired);
    await page.clock.setFixedTime(new Date());
    const before = signing.calls();
    await page.getByRole("button", { name: s.reauth, exact: true }).dblclick();
    await expect(page.getByRole("button", { name: c.newCodesConfirm })).toBeVisible();
    expect(signing.calls()).toBe(before + 1);
    await accessible(page);
    await page.getByRole("button", { name: c.newCodesConfirm }).click();
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    const regenerated = await page.locator("[data-codes] li").allTextContents();
    expect(regenerated.some((code) => originalCodes.includes(code))).toBe(false);
    await expect(page.getByRole("button", { name: c.continue, exact: true })).toBeDisabled();
    await page.getByLabel(c.savedConfirm).check();
    await page.getByRole("button", { name: c.continue, exact: true }).click();
    const oldSession = await browser.newContext({ storageState: await context.storageState() });
    const oldPage = await oldSession.newPage(); await oldPage.goto(`/${lang}/account/`);
    // The old set is invalid even though this particular code was never used.
    await submitRecoveryCode(page, lang, originalCodes[0]!);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.error_recovery_invalid);
    await submitRecoveryCode(page, lang, regenerated[0]!);
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/recovery/$`));
    expect(await whoAmI(page)).toMatchObject({ id: original.id, scope: "recovery" });
    expect(await apiStatus(oldPage)).toBe(401);
    expect(await apiStatus(page, "/api/me/progress")).toBe(403);
    const recoverySession = await browser.newContext({ storageState: await context.storageState() });
    const recoveryPage = await recoverySession.newPage(); await recoveryPage.goto(`/${lang}/account/recovery/`);
    await page.getByText(learningIdentityCopy[lang].ownSigner, { exact: true }).click();
    await page.getByLabel(learningIdentityCopy[lang].advancedLead, { exact: true }).check();
    await expect(page.getByText(s.replaceHelp)).toBeVisible();
    await expect(page.locator('main input:not([type="checkbox"])')).toHaveCount(0); // no key, seed or password field
    signing.use(key());
    await page.getByRole("button", { name: s.replace, exact: true }).click();
    await expect(page.getByText(s.replaceWarning)).toBeVisible();
    await accessible(page);
    await page.getByRole("button", { name: s.replaceConfirm }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    await expect(page.getByText(s.replaced)).toBeVisible();
    await expect(page.getByRole("heading", { name: c.codesHeading })).toBeFocused();
    const replacementCodes = await page.locator("[data-codes] li").allTextContents();
    expect(replacementCodes.some((code) => regenerated.includes(code))).toBe(false);
    expect(await apiStatus(recoveryPage)).toBe(401); // the initiating recovery session was rotated, too
    expect(await whoAmI(page)).toMatchObject({ id: original.id, scope: "full" });
    expect(await page.evaluate(async () => (await (await fetch("/api/me/progress")).json()).lessons["savers/money-and-bitcoin"].completedAt)).toBeTruthy();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: c.downloadCodes }).click();
    expect((await download).suggestedFilename()).toBe("jifunze-recovery-codes.txt");
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(new RegExp(replacementCodes.join("|")));
    expect(proofs.length).toBeGreaterThan(3);
    expect(proofs.every((proof) => !proof.includes("fixture-never-forward") && Object.keys(JSON.parse(proof)).sort().join() === "content,created_at,id,kind,pubkey,sig,tags")).toBe(true);
    await page.getByLabel(c.savedConfirm).check();
    await page.getByRole("button", { name: c.continue, exact: true }).click();
    await page.reload();
    await expect(page.locator("[data-codes] li")).toHaveCount(0); // not recoverable from storage or query parameters
    // One further redemption keeps this fresh suite at exactly five attempts, under the unchanged real limit.
    if (lang === "sw") {
      await submitRecoveryCode(page, lang, regenerated[1]!);
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.error_recovery_invalid);
    }
    await oldSession.close(); await recoverySession.close();
  });

  test(`${lang}: deletion requires a fresh proof and explicit confirmation; unsynchronized device progress survives`, async ({ page, context, browser }) => {
    const signing = await signer(page);
    await signup(page, lang);
    const original = await whoAmI(page);
    const old = await browser.newContext({ storageState: await context.storageState() });
    const other = await old.newPage(); await other.goto(`/${lang}/account/`);
    await page.getByRole("button", { name: s.delete, exact: true }).click();
    await expect(page.getByLabel(s.deleteConfirm)).toHaveCount(0);
    await page.getByRole("button", { name: s.reauth, exact: true }).click();
    await expect(page.getByLabel(s.deleteConfirm)).not.toBeChecked();
    await expect(page.getByRole("button", { name: s.delete, exact: true })).toBeDisabled();
    await page.getByRole("button", { name: s.cancel, exact: true }).click();
    expect(await apiStatus(page)).toBe(200);
    await page.getByRole("button", { name: s.delete, exact: true }).click();
    await page.getByRole("button", { name: s.reauth, exact: true }).click();
    await page.evaluate((storageKey) => {
      localStorage.setItem(storageKey, JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/retained": { completedAt: "unreadable-import" } } }));
      localStorage.setItem("jifunze:sync:dirty:v1", "1");
    }, PROGRESS);
    await page.getByLabel(s.removeLocal).check();
    await page.getByLabel(s.deleteConfirm).check();
    await accessible(page);
    await page.getByRole("button", { name: s.delete, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: s.deletedUnsent })).toBeVisible();
    expect(await apiStatus(page)).toBe(401);
    expect(await apiStatus(other)).toBe(401);
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).lessons["savers/retained"].completedAt, PROGRESS)).toBe("unreadable-import");
    expect(await page.evaluate(() => localStorage.getItem("jifunze:progress:owner:v1"))).toBeNull();
    // The same public identity now creates a new account; the deleted server progress does not return.
    await page.goto(`/${lang}/account/signin/#own`);
    await page.getByRole("button", { name: c.continueNostr }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/welcome/$`));
    expect((await whoAmI(page)).id).not.toBe(original.id);
    expect(signing.calls()).toBe(4);
    await old.close();
  });
}

test("sign out everywhere keeps device progress and revokes both real sessions", async ({ page, context, browser }) => {
  const signing = await signer(page);
  await signup(page, "en");
  const another = await browser.newContext(); const other = await another.newPage();
  const otherSigner = await signer(other); otherSigner.use(signing.key());
  await other.goto("/en/account/signin/#own"); await other.getByRole("button", { name: accountCopy.en.continueNostr }).click();
  await expect(other).toHaveURL(/\/en\/account\/$/);
  await complete(page, "en");
  await page.goto("/en/account/");
  await page.getByRole("button", { name: accountSecurityCopy.en.logoutAll }).click();
  await page.getByRole("button", { name: accountSecurityCopy.en.logoutConfirm }).click();
  await expect(page.getByText(accountSecurityCopy.en.loggedOut)).toBeVisible();
  expect(await apiStatus(page)).toBe(401); expect(await apiStatus(other)).toBe(401);
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).lessons["savers/money-and-bitcoin"].completedAt, PROGRESS)).toBeTruthy();
  expect((await context.cookies()).some((c) => c.name === "__Host-jf_session")).toBe(false);
  await another.close();
});

test("full-session replacement needs the existing signer; an occupied identity and a lost response never report success", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const c = accountCopy.en, s = accountSecurityCopy.en;
  const signing = await signer(page);
  await signup(page, "en");
  const original = await whoAmI(page), oldKey = signing.key();
  const occupied = await browser.newContext(), other = await occupied.newPage();
  const otherSigning = await signer(other); await signup(other, "en");
  const otherAccount = await whoAmI(other), originalCookies = await page.context().cookies();
  // Switch the real HttpOnly cookie after the preflight GET has reached A but before the mutation.
  // A UI-only check would pass; the server must reject the stale expectation on the POST itself.
  await page.getByRole("button", { name: s.delete, exact: true }).click();
  await page.getByRole("button", { name: s.reauth, exact: true }).click();
  await page.getByLabel(s.deleteConfirm).check();
  let switched = false;
  await page.route("**/api/me", async (route) => {
    if (switched) { await route.continue(); return; }
    switched = true;
    const response = await route.fetch();
    await page.context().addCookies(await occupied.cookies());
    await page.evaluate((id) => localStorage.setItem("jifunze:account:v1", id), otherAccount.id);
    await route.fulfill({ response });
  });
  const deletes: string[] = [];
  page.on("request", (r) => { if (r.url().endsWith("/api/me/delete")) deletes.push(r.method()); });
  const rejection = page.waitForResponse((r) => r.url().endsWith("/api/me/delete"));
  await page.getByRole("button", { name: s.delete, exact: true }).click();
  await expect(page.getByText(s.accountChanged)).toBeVisible();
  expect((await rejection).status()).toBe(409);
  expect((await (await rejection).json()).error.code).toBe("account_changed");
  expect(deletes).toEqual(["POST"]);
  await page.unroute("**/api/me");
  expect(await apiStatus(other)).toBe(200);
  expect((await whoAmI(page)).id).toBe(otherAccount.id);
  expect(await page.evaluate(() => localStorage.getItem("jifunze:account:v1"))).toBe(otherAccount.id);
  await page.context().addCookies(originalCookies);
  await page.evaluate((id) => localStorage.setItem("jifunze:account:v1", id), original.id);
  await page.reload();
  await page.getByRole("button", { name: s.replace, exact: true }).click();
  await page.evaluate(() => { delete (window as Window & { nostr?: unknown }).nostr; });
  await page.getByRole("button", { name: s.reauth, exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(s.noSigner);
  await page.reload();
  await page.getByRole("button", { name: s.replace, exact: true }).click();
  await page.getByRole("button", { name: s.reauth, exact: true }).click();
  await expect(page.getByRole("button", { name: s.replaceConfirm })).toBeVisible();
  signing.use(otherSigning.key());
  await page.getByRole("button", { name: s.replaceConfirm }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.error_identity_in_use);
  expect((await whoAmI(page)).id).toBe(original.id);
  await expect(page.locator("[data-codes] li")).toHaveCount(0);
  signing.use(key());
  await page.getByRole("button", { name: s.replaceConfirm }).click();
  await expect(page.getByText(s.replaced)).toBeVisible();
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  await page.getByLabel(c.savedConfirm).check();
  await page.getByRole("button", { name: c.continue, exact: true }).click();
  const newPubkey = signedEvent(new Uint8Array(), "", undefined, {}, [], signing.key()).pubkey;
  await expect(page.locator("[data-nostr-pubkey]")).toHaveText(newPubkey);
  expect((await whoAmI(page)).id).toBe(original.id);
  await page.getByRole("button", { name: s.replace, exact: true }).click();
  await page.getByRole("button", { name: s.reauth, exact: true }).click();
  await expect(page.getByRole("button", { name: s.replaceConfirm })).toBeVisible();
  signing.use(oldKey);
  await page.route("**/api/auth/nostr/replace", (route) => route.abort("failed"));
  await page.getByRole("button", { name: s.replaceConfirm }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(s.uncertain);
  await expect(page.getByRole("button", { name: s.replaceConfirm })).toBeDisabled();
  await expect(page.locator("[data-nostr-pubkey]")).toHaveText(newPubkey);
  await expect(page.locator("[data-codes] li")).toHaveCount(0);
  await occupied.close();
});
