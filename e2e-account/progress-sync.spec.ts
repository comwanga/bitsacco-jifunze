import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { signedEvent } from "../api/test/nostr-helper";
import { accountCopy } from "../lib/account-copy";
import { discussionCopy } from "../lib/discussion-copy";
import { t } from "../lib/i18n";
import { syncCopy } from "../lib/sync-copy";
import { finishWelcome } from "./helpers";

// Stage 3: a signed-in learner's device copy and account copy of progress, in a real browser against the real API
// and PostgreSQL. Sign-ins are kept few: the API's own rate limits apply to this suite.
test.describe.configure({ retries: 0 });

const lang = "en";
const c = accountCopy[lang];
const s = syncCopy[lang];
const PROGRESS = "jifunze:progress:v1";
type Key = Parameters<typeof signedEvent>[5];
const newKey = () => new Uint8Array(randomBytes(32)) as NonNullable<Key>;

/** A browser profile ("device") with a signer extension whose key can be swapped, as on a shared phone. */
async function device(browser: Browser, key: NonNullable<Key>): Promise<{ context: BrowserContext; page: Page; use: (k: NonNullable<Key>) => void }> {
  const context = await browser.newContext();
  let current = key;
  await context.exposeFunction("fakeNostrSign", async (event: { created_at: number }) => signedEvent(new Uint8Array(), "", event.created_at, event, [], current));
  await context.addInitScript(() => {
    Object.assign(window, { nostr: { signEvent: (e: unknown) => (window as unknown as { fakeNostrSign: (e: unknown) => Promise<unknown> }).fakeNostrSign(e) } });
  });
  return { context, page: await context.newPage(), use: (k) => { current = k; } };
}

/** Signs in with the device's current key and ends on the account page. */
async function signIn(page: Page): Promise<void> {
  await page.goto(`/${lang}/account/signin/`);
  await page.getByRole("button", { name: c.continueNostr }).click();
  await page.waitForURL(new RegExp(`/${lang}/account/(welcome/)?$`));
  if (page.url().endsWith("/welcome/")) {
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    await finishWelcome(page, lang);
  }
  await expect(page.locator("[data-progress-sync]")).toBeVisible();
}
const panel = (page: Page) => page.locator("[data-progress-sync]");

async function complete(page: Page, slug: string): Promise<void> {
  await page.goto(`/${lang}/savers/${slug}/`);
  await page.getByRole("button", { name: discussionCopy[lang].confirm, exact: true }).click();
  await page.getByRole("button", { name: t(lang, "markComplete"), exact: true }).click();
  await expect(page.locator('p[aria-live="polite"]').filter({ hasText: t(lang, "markedComplete") })).toBeVisible();
}
type Lessons = Record<string, { completedAt?: string; reflectedAt?: string }>;
const onDevice = (page: Page): Promise<Lessons> =>
  page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? '{"lessons":{}}') as { lessons: Lessons }).lessons, PROGRESS);
/** The account's saved progress, read with this browser's session; null when there is no session. */
const inAccount = (page: Page): Promise<Lessons | null> =>
  page.evaluate(async () => {
    const r = await fetch("/api/me/progress", { credentials: "same-origin", cache: "no-store" });
    return r.status === 200 ? ((await r.json()) as { lessons: Lessons }).lessons : null;
  });
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const apiCalls = (context: BrowserContext): string[] => {
  const seen: string[] = [];
  context.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) seen.push(`${r.method()} ${u.pathname}`); });
  return seen;
};

test("progress is saved to the account, restored on another device, and removed from a device at sign-out", async ({ browser }) => {
  const key = newKey();
  const phone = await device(browser, key);
  await signIn(phone.page);
  await expect(panel(phone.page)).toHaveAttribute("data-progress-sync", "mine:synced");
  await complete(phone.page, "money-and-bitcoin");
  await expect.poll(async () => (await inAccount(phone.page))?.["savers/money-and-bitcoin"]?.completedAt, { timeout: 15_000 }).toBeTruthy();
  const saved = (await inAccount(phone.page))!["savers/money-and-bitcoin"]!;
  expect(saved).toEqual((await onDevice(phone.page))["savers/money-and-bitcoin"]); // the same timestamps, not new ones

  // A second device with nothing on it: signing in restores the lesson, in either language.
  const laptop = await device(browser, key);
  await signIn(laptop.page);
  await expect(panel(laptop.page)).toHaveAttribute("data-progress-sync", "mine:synced");
  await expect(panel(laptop.page).getByRole("status")).toHaveText(s.syncSaved);
  expect((await onDevice(laptop.page))["savers/money-and-bitcoin"]).toEqual(saved);
  await laptop.page.goto("/sw/savers/money-and-bitcoin/");
  await expect(laptop.page.locator('p[aria-live="polite"]').filter({ hasText: t("sw", "markedComplete") })).toBeVisible();

  // Sign-out on the phone: the default leaves nothing behind, because the account has it all.
  await phone.page.goto(`/${lang}/account/signout/`);
  await expect(phone.page.getByRole("radio", { name: c.signOutRemove })).toBeChecked();
  await phone.page.getByRole("main").getByRole("button", { name: c.signOut, exact: true }).click();
  await expect(phone.page.getByRole("status").filter({ hasText: c.signedOutRemoved })).toBeVisible();
  for (const k of [PROGRESS, "jifunze:account:v1", "jifunze:progress:owner:v1", "jifunze:sync:dirty:v1"]) expect(await stored(phone.page, k)).toBeNull();
  // Signing in again brings it back.
  await signIn(phone.page);
  await expect(panel(phone.page)).toHaveAttribute("data-progress-sync", "mine:synced");
  expect((await onDevice(phone.page))["savers/money-and-bitcoin"]).toEqual(saved);
  await phone.context.close();
  await laptop.context.close();
});

test("progress made before signing in joins the account only after an explicit yes", async ({ browser }) => {
  const d = await device(browser, newKey());
  const calls = apiCalls(d.context);
  await complete(d.page, "sats-and-volatility");
  expect(calls).toEqual([]); // anonymous learning never calls the account service
  const before = await onDevice(d.page);

  await signIn(d.page);
  await expect(panel(d.page)).toHaveAttribute("data-progress-sync", "unclaimed:");
  await expect(panel(d.page)).toContainText(s.syncAsk);
  expect(await inAccount(d.page)).toEqual({});
  expect(calls.filter((x) => x === "POST /api/me/progress")).toEqual([]);

  await panel(d.page).getByRole("button", { name: s.syncNotNow }).click();
  await expect(panel(d.page)).toContainText(s.syncSeparate);
  await d.page.goto(`/${lang}/savers/sats-and-volatility/`); // keeps learning, signed in, without having agreed
  await d.page.waitForTimeout(3_000);
  expect(await inAccount(d.page)).toEqual({});
  expect(await onDevice(d.page)).toEqual(before); // untouched
  expect(calls.filter((x) => x === "POST /api/me/progress")).toEqual([]);

  await d.page.goto(`/${lang}/account/`);
  await panel(d.page).getByRole("button", { name: s.syncAdd }).click();
  await expect(panel(d.page)).toHaveAttribute("data-progress-sync", "mine:synced");
  expect(await inAccount(d.page)).toEqual(before);
  await d.context.close();
});

test("on a shared device a second learner never receives, overwrites or uploads the first learner's progress", async ({ browser }) => {
  const first = newKey(), second = newKey();
  const shared = await device(browser, first);
  await signIn(shared.page);
  await complete(shared.page, "wallets-keys");
  await expect.poll(async () => (await inAccount(shared.page))?.["savers/wallets-keys"]?.completedAt, { timeout: 15_000 }).toBeTruthy();
  const firstSaved = await inAccount(shared.page);

  // The first learner signs out and chooses to keep a copy on the device.
  await shared.page.goto(`/${lang}/account/signout/`);
  await shared.page.getByRole("radio", { name: c.signOutKeep }).check();
  await shared.page.getByRole("main").getByRole("button", { name: c.signOut, exact: true }).click();
  await expect(shared.page.getByRole("status").filter({ hasText: c.signedOutDone })).toBeVisible();
  expect(Object.keys(await onDevice(shared.page))).toEqual(["savers/wallets-keys"]);

  // A different learner signs in on the same device.
  shared.use(second);
  const calls = apiCalls(shared.context);
  await signIn(shared.page);
  await expect(panel(shared.page)).toHaveAttribute("data-progress-sync", "other:");
  await expect(panel(shared.page)).toContainText(s.syncOther);
  expect(await inAccount(shared.page)).toEqual({}); // nothing of the first learner reached this account
  await shared.page.goto(`/${lang}/savers/wallets-keys/`);
  await shared.page.waitForTimeout(3_000);
  expect(calls.filter((x) => x === "POST /api/me/progress")).toEqual([]); // and nothing is uploaded from this copy
  expect(await inAccount(shared.page)).toEqual({});

  // Only an explicit, confirmed replacement changes the device.
  await shared.page.goto(`/${lang}/account/`);
  await panel(shared.page).getByRole("button", { name: s.syncReplace }).click();
  await expect(panel(shared.page)).toContainText(s.syncReplaceWarn);
  expect(Object.keys(await onDevice(shared.page))).toEqual(["savers/wallets-keys"]); // not yet
  await panel(shared.page).getByRole("button", { name: s.syncReplaceConfirm }).click();
  await expect(panel(shared.page)).toHaveAttribute("data-progress-sync", "mine:synced");
  expect(await onDevice(shared.page)).toEqual({});
  expect(await inAccount(shared.page)).toEqual({});

  // The first learner's account is exactly as it was.
  const own = await device(browser, first);
  await signIn(own.page);
  expect(await inAccount(own.page)).toEqual(firstSaved);
  await shared.context.close();
  await own.context.close();
});

test("two tabs, offline work, reconnection and an ended session lose nothing", async ({ browser }) => {
  const d = await device(browser, newKey());
  await signIn(d.page);
  const second = await d.context.newPage();

  // Two tabs each finish a different lesson.
  await complete(d.page, "money-and-bitcoin");
  await complete(second, "scams");
  await expect.poll(async () => Object.keys((await inAccount(d.page)) ?? {}).sort(), { timeout: 20_000 }).toEqual(["savers/money-and-bitcoin", "savers/scams"]);
  expect(Object.keys(await onDevice(second)).sort()).toEqual(["savers/money-and-bitcoin", "savers/scams"]);

  // Offline: the lesson is still completed and kept on the device, marked as unsent.
  await d.page.goto(`/${lang}/savers/lightning-payments/`);
  await d.context.setOffline(true);
  await d.page.getByRole("button", { name: discussionCopy[lang].confirm, exact: true }).click();
  await d.page.getByRole("button", { name: t(lang, "markComplete"), exact: true }).click();
  await expect(d.page.locator('p[aria-live="polite"]').filter({ hasText: t(lang, "markedComplete") })).toBeVisible();
  await d.page.waitForTimeout(3_000);
  expect((await onDevice(d.page))["savers/lightning-payments"]?.completedAt).toBeTruthy();
  expect(await stored(d.page, "jifunze:sync:dirty:v1")).toBe("1");
  // Back online: it is sent without the learner doing anything.
  await d.context.setOffline(false);
  await expect.poll(async () => (await inAccount(d.page))?.["savers/lightning-payments"]?.completedAt, { timeout: 20_000 }).toBeTruthy();
  await expect.poll(() => stored(d.page, "jifunze:sync:dirty:v1")).toBeNull();

  // The session is ended elsewhere. The next lesson is still saved on the device; syncing stops quietly.
  const ended = await d.page.evaluate(async () => (await fetch("/api/auth/logout/all", { method: "POST", headers: { "X-Jifunze": "1" }, credentials: "same-origin" })).status);
  expect(ended).toBe(204);
  await complete(d.page, "saving-together");
  await expect.poll(() => stored(d.page, "jifunze:account:v1"), { timeout: 15_000 }).toBeNull();
  expect((await onDevice(d.page))["savers/saving-together"]?.completedAt).toBeTruthy();
  expect(await stored(d.page, "jifunze:sync:dirty:v1")).toBe("1"); // still to be sent
  expect(Object.keys(await onDevice(d.page))).toHaveLength(4);
  expect(await inAccount(d.page)).toBeNull();

  // Signing in again as the same learner sends the kept lesson.
  await signIn(d.page);
  await expect(panel(d.page)).toHaveAttribute("data-progress-sync", "mine:synced");
  expect(Object.keys((await inAccount(d.page))!).sort()).toEqual(["savers/lightning-payments", "savers/money-and-bitcoin", "savers/saving-together", "savers/scams"]);
  await d.context.close();
});
