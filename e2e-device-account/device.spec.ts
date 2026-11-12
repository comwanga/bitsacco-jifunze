import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getPublicKey, verifyEvent } from "nostr-tools/pure";
import { accountCopy } from "../lib/account-copy";
import { learningIdentityCopy } from "../lib/learning-identity-copy";
import { syncCopy } from "../lib/sync-copy";
import { finishWelcome, submitRecoveryCode, whoAmI } from "../e2e-account/helpers";

const storedKey = (page: Page) => page.evaluate(() => new Promise<number[] | null>((resolve, reject) => {
  const request = indexedDB.open("jifunze-identity", 1);
  request.onerror = () => reject(new Error("storage"));
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction("keys"), get = tx.objectStore("keys").get("learning");
    tx.oncomplete = () => { db.close(); resolve(get.result ? Array.from(get.result as Uint8Array) : null); };
    tx.onerror = () => { db.close(); reject(new Error("storage")); };
  };
}));
const progress = (page: Page) => page.evaluate(async () => (await (await fetch("/api/me/progress")).json()).lessons);
const status = (page: Page) => page.evaluate(async () => (await fetch("/api/me")).status);

async function save(page: Page, lang: "en" | "sw" = "en") {
  await page.goto(`/${lang}/account/signin/`);
  await page.locator("[data-save-progress]").click();
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  const codes = await page.locator("[data-codes] li").allTextContents();
  await finishWelcome(page, lang);
  return codes;
}

for (const lang of ["en", "sw"] as const) {
  const c = accountCopy[lang], l = learningIdentityCopy[lang];
  test(`${lang}: device identity saves, resumes, confirms security and recovers progress without an external signer`, async ({ page, browser, context }) => {
    test.setTimeout(90_000);
    const requests: import("@playwright/test").Request[] = [], sockets: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r); });
    page.on("websocket", (socket) => sockets.push(socket.url()));
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/${lang}/account/signin/`);
    expect(requests).toEqual([]);
    await expect(page.locator("[data-save-progress]")).toHaveText(l.save);
    await expect(page.getByRole("button", { name: c.continueNostr })).toHaveCount(0);
    await expect(page.getByText(l.warning)).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`${lang}-signin.png`), fullPage: true });
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.evaluate(() => localStorage.setItem("jifunze:progress:v1", JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": { completedAt: new Date(Date.now() - 1000).toISOString() } } })));
    await page.locator("[data-save-progress]").evaluate((el) => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    const initial = await page.locator("[data-codes] li").allTextContents();
    await expect(page.getByText(l.welcomeLead)).toBeVisible();
    await expect(page.getByText(l.limits)).toBeVisible();
    await expect(page.getByRole("button", { name: c.continue, exact: true })).toBeDisabled();
    expect((await context.cookies()).find((cookie) => cookie.name === "__Host-jf_session")).toMatchObject({ secure: true, httpOnly: true });
    const secret = new Uint8Array((await storedKey(page))!);
    const pubkey = getPublicKey(secret), original = await whoAmI(page);
    const proofs = requests.filter((r) => r.url().endsWith("/api/auth/nostr/verify"));
    expect(proofs).toHaveLength(1);
    const event = JSON.parse(Buffer.from(proofs[0]!.headers().authorization!.slice(6), "base64").toString());
    expect(verifyEvent(event)).toBe(true); expect(event.pubkey).toBe(pubkey);
    const secretHex = Buffer.from(secret).toString("hex"); secret.fill(0);
    expect(JSON.stringify(requests.map((r) => ({ url: r.url(), body: r.postData(), headers: r.headers() })))).not.toContain(secretHex);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(secretHex);
    await finishWelcome(page, lang);
    await expect(page.getByRole("button", { name: syncCopy[lang].syncAdd })).toBeVisible();
    expect(await progress(page)).toEqual({}); // anonymous work requires explicit consent
    await page.getByRole("button", { name: syncCopy[lang].syncAdd }).click();
    await expect(page.locator("[data-progress-sync]")).toHaveAttribute("data-progress-sync", "mine:synced");
    expect((await progress(page))["savers/money-and-bitcoin"].completedAt).toBeTruthy();
    await page.goto(`/${lang}/account/signin/`);
    await page.locator("[data-save-progress]").click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/$`));
    expect(requests.filter((r) => r.url().endsWith("/api/auth/nostr/verify"))).toHaveLength(1); // existing session
    await context.clearCookies();
    await page.goto(`/${lang}/account/signin/`);
    await expect(page.locator("[data-save-progress]")).toHaveText(l.resume);
    await page.locator("[data-save-progress]").click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/$`));
    expect((await whoAmI(page)).id).toBe(original.id);
    await page.getByRole("button", { name: c.newCodes, exact: true }).click();
    await page.getByRole("button", { name: l.confirm, exact: true }).click();
    await page.getByRole("button", { name: c.newCodesConfirm }).click();
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    const regenerated = await page.locator("[data-codes] li").allTextContents();
    await page.getByLabel(c.savedConfirm).check();
    await page.getByRole("button", { name: c.continue, exact: true }).click();
    expect(sockets).toEqual([]);

    // A fresh browser simulates storage loss/a new phone. A code restores this account, never the old secret.
    const replacement = await browser.newContext(), next = await replacement.newPage();
    try {
      await submitRecoveryCode(next, lang, regenerated[0]!);
      await expect(next).toHaveURL(new RegExp(`/${lang}/account/recovery/$`));
      expect(await whoAmI(next)).toMatchObject({ id: original.id, scope: "recovery" });
      expect(await status(page)).toBe(401);
      await expect(next.getByText(l.renewHelp)).toBeVisible();
      await next.getByRole("button", { name: l.renew, exact: true }).click();
      await next.getByRole("button", { name: l.renew, exact: true }).click();
      await expect(next.locator("[data-codes] li")).toHaveCount(10);
      const newCodes = await next.locator("[data-codes] li").allTextContents();
      expect(newCodes.some((code) => regenerated.includes(code) || initial.includes(code))).toBe(false);
      expect(getPublicKey(new Uint8Array((await storedKey(next))!))).not.toBe(pubkey);
      expect(await whoAmI(next)).toMatchObject({ id: original.id, scope: "full" });
      await next.getByLabel(c.savedConfirm).check();
      await next.getByRole("button", { name: c.continue, exact: true }).click();
      await expect(next.locator("[data-progress-sync]")).toHaveAttribute("data-progress-sync", "mine:synced");
      expect((await progress(next))["savers/money-and-bitcoin"].completedAt).toBeTruthy();
      await submitRecoveryCode(page, lang, regenerated[1]!);
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(c.error_recovery_invalid);
      await next.goto(`/${lang}/account/signout/`);
      await expect(next.getByLabel(l.forget)).toBeChecked();
      await next.getByRole("button", { name: c.signOut, exact: true }).click();
      await expect(next.getByText(l.forgotten)).toBeVisible();
      expect(await storedKey(next)).toBeNull();
      expect(await status(next)).toBe(401);
      await next.screenshot({ path: test.info().outputPath(`${lang}-signed-out.png`), fullPage: true });
    } finally { await replacement.close(); }
  });
}

test("clearing browser storage and cookies still permits recovery of the same account and server progress", async ({ page, context }) => {
  const c = accountCopy.en, l = learningIdentityCopy.en;
  const codes = await save(page), original = await whoAmI(page);
  expect(await page.evaluate(async () => (await fetch("/api/me/progress", {
    method: "POST", headers: { "X-Jifunze": "1", "Content-Type": "application/json" },
    body: JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/wallets-keys": { completedAt: new Date().toISOString() } } }),
  })).status)).toBe(200);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    localStorage.clear(); sessionStorage.clear();
    const request = indexedDB.deleteDatabase("jifunze-identity");
    request.onsuccess = () => resolve(); request.onerror = () => reject(new Error("storage"));
  }));
  await context.clearCookies();
  await submitRecoveryCode(page, "en", codes[0]!);
  await expect(page).toHaveURL(/\/en\/account\/recovery\/$/);
  await page.getByRole("button", { name: l.renew, exact: true }).click();
  await page.getByRole("button", { name: l.renew, exact: true }).click();
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  await page.getByLabel(c.savedConfirm).check();
  await page.getByRole("button", { name: c.continue, exact: true }).click();
  await expect(page.locator("[data-progress-sync]")).toHaveAttribute("data-progress-sync", "mine:synced");
  expect((await whoAmI(page)).id).toBe(original.id);
  expect((await progress(page))["savers/wallets-keys"].completedAt).toBeTruthy();
});

test("retaining an identity permits later sign-in; removing it keeps another account's device progress isolated", async ({ page }) => {
  const c = accountCopy.en, l = learningIdentityCopy.en;
  await save(page); const original = await whoAmI(page);
  await page.evaluate((id) => {
    localStorage.setItem("jifunze:progress:v1", JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/retained": { completedAt: "unreadable-import" } } }));
    localStorage.setItem("jifunze:progress:owner:v1", id);
  }, original.id);
  await page.goto("/en/account/signout/");
  await page.getByLabel(l.forget).uncheck();
  await page.getByRole("button", { name: c.signOut, exact: true }).click();
  expect(await storedKey(page)).not.toBeNull();
  await page.goto("/en/account/signin/"); await page.locator("[data-save-progress]").click();
  await expect(page).toHaveURL(/\/en\/account\/$/); expect((await whoAmI(page)).id).toBe(original.id);
  await page.goto("/en/account/signout/");
  await page.getByRole("button", { name: c.signOut, exact: true }).click();
  await expect(page.getByText(l.forgotten)).toBeVisible();
  expect(await storedKey(page)).toBeNull();
  await save(page);
  expect((await whoAmI(page)).id).not.toBe(original.id);
  await expect(page.getByText(syncCopy.en.syncOther)).toBeVisible();
  expect(await progress(page)).toEqual({});
  expect(await page.evaluate(() => localStorage.getItem("jifunze:progress:owner:v1"))).toBe(original.id);
});

test("storage failure and corrupt stored keys fail before an authentication challenge", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r.url()); });
  await page.goto("/en/account/signin/");
  await page.evaluate(() => Object.defineProperty(window, "indexedDB", { configurable: true, value: { open: () => { throw new Error("denied"); } } }));
  await page.locator("[data-save-progress]").click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(learningIdentityCopy.en.storage);
  expect(requests).toEqual([]);
  await page.reload();
  await page.evaluate(() => new Promise<void>((resolve) => {
    const r = indexedDB.open("jifunze-identity", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("keys");
    r.onsuccess = () => { const db = r.result, tx = db.transaction("keys", "readwrite"); tx.objectStore("keys").put(new Uint8Array(32), "learning"); tx.oncomplete = () => { db.close(); resolve(); }; };
  }));
  await page.locator("[data-save-progress]").click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(learningIdentityCopy.en.storage);
  expect(requests).toEqual([]);
});

test("two tabs create one identity and a connection failure retries with the same identity", async ({ page, context }) => {
  await context.route("**/api/auth/nostr/challenge", (route) => route.abort("failed"));
  const other = await context.newPage();
  await Promise.all([page.goto("/en/account/signin/"), other.goto("/en/account/signin/")]);
  await Promise.all([page.locator("[data-save-progress]").click(), other.locator("[data-save-progress]").click()]);
  for (const tab of [page, other]) await expect(tab.getByRole("main").getByRole("alert")).toHaveText(accountCopy.en.error_network);
  const before = await storedKey(page);
  expect(before).toEqual(await storedKey(other));
  await context.unroute("**/api/auth/nostr/challenge");
  await page.locator("[data-save-progress]").click();
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  expect(await storedKey(page)).toEqual(before);
});

test("a stale sign-out page cannot end a different learner's session or erase the earlier key", async ({ page, browser, context }) => {
  await save(page);
  const retained = await storedKey(page);
  const occupied = await browser.newContext(), other = await occupied.newPage();
  try {
    await save(other); const second = await whoAmI(other);
    await page.goto("/en/account/signout/");
    const button = page.getByRole("button", { name: accountCopy.en.signOut, exact: true });
    await expect(button).toBeEnabled();
    await context.addCookies(await occupied.cookies());
    await page.evaluate((id) => localStorage.setItem("jifunze:account:v1", id), second.id);
    await button.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(accountCopy.en.error_account_changed);
    expect((await whoAmI(page)).id).toBe(second.id);
    expect(await storedKey(page)).toEqual(retained);
  } finally { await occupied.close(); }
});

test("a learner signing in in another tab cannot be replaced by a delayed device sign-in", async ({ page, browser, context }) => {
  const occupied = await browser.newContext(), other = await occupied.newPage();
  try {
    await save(other); const account = await whoAmI(other);
    await page.goto("/en/account/signin/");
    await page.route("**/api/me", async (route) => {
      const response = await route.fetch();
      await context.addCookies(await occupied.cookies());
      await route.fulfill({ response });
    });
    await page.locator("[data-save-progress]").click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(accountCopy.en.error_account_changed);
    expect((await whoAmI(page)).id).toBe(account.id);
  } finally { await occupied.close(); }
});
