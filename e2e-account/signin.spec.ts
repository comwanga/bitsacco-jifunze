import { expect, test } from "@playwright/test";
import { accountCopy, errorText } from "../lib/account-copy";
import { siteCopy } from "../lib/site-copy";
import { continueWithGithub, finishWelcome, freshUser, LANGS, SESSION_COOKIE, signUp, trackRequests } from "./helpers";

// Sign-in against the real API and a fake GitHub (not real GitHub authentication).

for (const lang of LANGS) {
  const c = accountCopy[lang];

  test(`${lang}: GitHub sign-in, recovery codes, account home and sign out`, async ({ page, context }) => {
    const requests = trackRequests(context);
    const user = freshUser();

    const codes = await signUp(page, lang, user);
    // The language goes out to the API with the sign-in and comes back in the path.
    const start = requests.find((r) => r.path.startsWith("/api/auth/github/start?"));
    expect(new URL(start!.path, "http://x").searchParams.get("lang")).toBe(lang);
    expect(new URL(page.url()).pathname).toBe(`/${lang}/account/welcome/`);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){3}$/);

    // Continue stays disabled until "I've saved them" is ticked.
    const cont = page.getByRole("button", { name: c.continue, exact: true });
    await expect(cont).toBeDisabled();
    await page.getByLabel(c.savedConfirm).check();
    await expect(cont).toBeEnabled();
    await page.getByLabel(c.savedConfirm).uncheck();
    await expect(cont).toBeDisabled();
    await finishWelcome(page, lang);
    await expect(page.locator("[data-github-handle]")).toHaveText(`@${user.login}`);

    const session = (await context.cookies()).find((k) => k.name === SESSION_COOKIE);
    expect(session, "the session cookie is set").toBeDefined();
    expect(session!.httpOnly).toBe(true);
    expect(session!.secure).toBe(true);
    expect(session!.path).toBe("/");
    expect(await page.evaluate(() => document.cookie)).not.toContain("jf_session");

    // Opening the sign-out page alone never signs anyone out.
    await page.getByRole("main").getByRole("link", { name: c.signOut, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/account/signout/$`));
    const button = page.getByRole("main").getByRole("button", { name: c.signOut, exact: true });
    await expect(button).toBeEnabled();
    await page.waitForLoadState("networkidle");
    const logout = () => requests.filter((r) => r.method === "POST" && r.path === "/api/auth/logout");
    expect(logout()).toHaveLength(0);
    expect((await context.cookies()).some((k) => k.name === SESSION_COOKIE)).toBe(true);

    await button.click();
    await expect(page.getByRole("status").filter({ hasText: c.signedOutDone })).toBeVisible();
    expect(logout()).toHaveLength(1);
    expect((await context.cookies()).some((k) => k.name === SESSION_COOKIE)).toBe(false);

    await page.goto(`/${lang}/account/`);
    await expect(page.getByText(c.signedOut)).toBeVisible();
  });

  test(`${lang}: a denied GitHub consent shows the localized message`, async ({ page }) => {
    await page.goto(`/${lang}/account/signin/`);
    await page.getByRole("main").getByRole("link", { name: c.continueGithub }).click();
    await expect(page.getByRole("heading", { name: "Fake GitHub (test only)" })).toBeVisible();
    await page.getByRole("button", { name: "Deny" }).click();

    await expect(page).toHaveURL(new RegExp(`/${lang}/account/signin/$`)); // ?error= is shown once, then dropped
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(errorText(lang, "github_denied"));
    await expect(page.getByRole("main").getByRole("link", { name: c.continueGithub })).toBeVisible();
  });
}

test("an existing GitHub user signs in to the same account without new codes", async ({ page }) => {
  const user = freshUser();
  await signUp(page, "en", user);
  await finishWelcome(page, "en");
  await page.context().clearCookies();
  await continueWithGithub(page, "en", user);
  await expect(page).toHaveURL(/\/en\/account\/$/);
  await expect(page.locator("[data-github-handle]")).toHaveText(`@${user.login}`);
});

test("the service worker stores no API response and no account page", async ({ page }) => {
  await page.goto("/sw/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await signUp(page, "sw", freshUser());
  await finishWelcome(page, "sw");
  // Browse while the worker controls the page: reloads, in-app navigation and a lesson.
  await page.reload();
  await expect(page.locator("[data-github-handle]")).toBeVisible();
  await page.goto("/sw/account/signout/");
  await page.goto("/sw/account/recovery/");
  await page.goto("/sw/savers/");
  await page.getByRole("banner").getByRole("link", { name: siteCopy.sw.account, exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/sw\/account\/$/);
  await expect(page.locator("[data-github-handle]")).toBeVisible();
  await page.waitForLoadState("networkidle");

  const stored = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    }
    return urls;
  });
  expect(stored.length, "the worker cached the public pages it always keeps").toBeGreaterThan(0);
  expect(stored.filter((p) => p.startsWith("/api/"))).toEqual([]);
  expect(stored.filter((p) => /^\/(sw|en)\/account(\/|$)/.test(p))).toEqual([]);
});

test("an anonymous visit to the home page makes no account API request", async ({ page, context }) => {
  const requests = trackRequests(context);
  await page.goto("/sw/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.filter((r) => r.path.startsWith("/api"))).toEqual([]);
});
