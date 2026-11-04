import { randomInt } from "node:crypto";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { accountCopy } from "../lib/account-copy";
import type { Lang } from "../lib/i18n";

export const LANGS = ["sw", "en"] as const satisfies readonly Lang[];
export const SESSION_COOKIE = "__Host-jf_session";

export type FakeUser = { id: number; login: string };

/** A GitHub user no other test (or earlier run against the same database) has used. */
export function freshUser(): FakeUser {
  const id = randomInt(10_000_000, 2_000_000_000);
  return { id, login: `e2e-${id.toString(36)}` };
}

/** On the fake GitHub's consent page: approve as the given user. */
export async function approve(page: Page, user: FakeUser): Promise<void> {
  await expect(page.getByRole("heading", { name: "Fake GitHub (test only)" })).toBeVisible();
  await page.getByLabel("GitHub user id").fill(String(user.id));
  await page.getByLabel("GitHub login").fill(user.login);
  await page.getByRole("button", { name: "Approve as this user" }).click();
}

/** Every request the page or its service worker makes, as paths with their query and method. */
export function trackRequests(context: BrowserContext): { method: string; path: string }[] {
  const seen: { method: string; path: string }[] = [];
  context.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin === "http://localhost:4352") seen.push({ method: r.method(), path: `${u.pathname}${u.search}` });
  });
  return seen;
}

/** From the sign-in page, Continue with GitHub and approve. */
export async function continueWithGithub(page: Page, lang: Lang, user: FakeUser): Promise<void> {
  await page.goto(`/${lang}/account/signin/`);
  await page.getByRole("main").getByRole("link", { name: accountCopy[lang].continueGithub }).click();
  await approve(page, user);
}

/** Signs up a new GitHub user and returns the recovery codes the welcome page shows. */
export async function signUp(page: Page, lang: Lang, user: FakeUser): Promise<string[]> {
  await continueWithGithub(page, lang, user);
  await expect(page).toHaveURL(new RegExp(`/${lang}/account/welcome/$`));
  const codes = page.locator("[data-codes] li");
  await expect(codes).toHaveCount(10);
  return codes.allTextContents();
}

/** On the welcome page: tick "I've saved them" and Continue to the account home. */
export async function finishWelcome(page: Page, lang: Lang): Promise<void> {
  const c = accountCopy[lang];
  await page.getByLabel(c.savedConfirm).check();
  await page.getByRole("button", { name: c.continue, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${lang}/account/$`));
  await expect(page.getByRole("heading", { name: c.identityHeading })).toBeVisible();
}

/** Opens the sign-out page and presses Sign out. */
export async function signOut(page: Page, lang: Lang): Promise<void> {
  const c = accountCopy[lang];
  await page.goto(`/${lang}/account/signout/`);
  await page.getByRole("main").getByRole("button", { name: c.signOut, exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: c.signedOutDone })).toBeVisible();
}

/** Enters a recovery code on the sign-in page and submits it. */
export async function submitRecoveryCode(page: Page, lang: Lang, code: string): Promise<void> {
  const c = accountCopy[lang];
  await page.goto(`/${lang}/account/signin/`);
  await page.getByText(c.useRecoveryCode).click();
  await page.getByLabel(c.recoveryCodeLabel).fill(code);
  await page.getByRole("button", { name: c.recoveryCodeSubmit }).click();
}

/** The signed-in account's id and GitHub handle, read in the page with the browser's own cookies. */
export async function whoAmI(page: Page): Promise<{ id: string; handle: string | null; scope: string }> {
  return page.evaluate(async () => {
    const res = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
    if (res.status !== 200) throw new Error(`/api/me answered ${res.status}`);
    const me = (await res.json()) as { scope: string; account: { id: string }; identities: { handle: string | null }[] };
    return { id: me.account.id, handle: me.identities[0]?.handle ?? null, scope: me.scope };
  });
}
