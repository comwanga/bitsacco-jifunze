import { expect, test } from "@playwright/test";
import { accountCopy, errorText } from "../lib/account-copy";
import { approve, continueWithGithub, finishWelcome, freshUser, signOut, signUp, submitRecoveryCode, whoAmI } from "./helpers";

// Recovery against the real API and a fake GitHub. The API allows 5 recovery attempts per 15 minutes per IP,
// and every test comes from 127.0.0.1. Budget per run: 2 here (sw: use + reuse), 1 here (en), 1 in a11y = 4.
// No retries for these files: a retry would spend more attempts and could fail as rate_limited instead.
test.describe.configure({ retries: 0 });

test("sw: a recovery code, Replace GitHub, and a reused code", async ({ page }) => {
  const c = accountCopy.sw;
  const oldUser = freshUser();
  const newUser = freshUser();

  // The account is created in English, so its saved language differs from the page recovery starts on.
  const codes = await signUp(page, "en", oldUser);
  await finishWelcome(page, "en");
  const original = await whoAmI(page);
  await signOut(page, "en");

  // A code from welcome opens the restricted recovery session, in the language of the page it was entered on.
  await submitRecoveryCode(page, "sw", codes[0]!);
  await expect(page).toHaveURL(/\/sw\/account\/recovery\/$/);
  await expect(page.getByRole("heading", { name: c.replaceHeading })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(`@${oldUser.login}`);
  expect(await whoAmI(page)).toMatchObject({ id: original.id, scope: "recovery" });

  // Replace GitHub with a second fake user: a fresh full session on the same account.
  await page.getByRole("main").getByRole("link", { name: c.replaceGithub }).click();
  await approve(page, newUser);
  await expect(page).toHaveURL(/\/sw\/account\/$/); // ?replaced=github is shown once, then dropped
  await expect(page.getByRole("status").filter({ hasText: c.replacedGithub })).toBeVisible();
  await expect(page.locator("[data-github-handle]")).toHaveText(`@${newUser.login}`);
  expect(await whoAmI(page)).toEqual({ id: original.id, handle: newUser.login, scope: "full" });
  await signOut(page, "sw");

  // The old GitHub user is no longer linked to anything: signing in with it creates a new account.
  await signUp(page, "sw", oldUser);
  const other = await whoAmI(page);
  expect(other.id).not.toBe(original.id);
  expect(other.handle).toBe(oldUser.login);
  await signOut(page, "sw");

  // The new GitHub user reaches the original account, with no welcome page.
  await continueWithGithub(page, "sw", newUser);
  await expect(page).toHaveURL(/\/sw\/account\/$/);
  await expect(page.locator("[data-github-handle]")).toHaveText(`@${newUser.login}`);
  expect((await whoAmI(page)).id).toBe(original.id);
  await signOut(page, "sw");

  // A used code never works again.
  await submitRecoveryCode(page, "sw", codes[0]!);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(errorText("sw", "recovery_invalid"));
  await expect(page).toHaveURL(/\/sw\/account\/signin\/$/);
});

test("en: a recovery code entered on the English page opens the English recovery page, whatever the account's language", async ({ page }) => {
  const c = accountCopy.en;
  // A Kiswahili account: the recovery page must still follow the English page the code was entered on.
  const codes = await signUp(page, "sw", freshUser());
  await finishWelcome(page, "sw");
  await signOut(page, "sw");

  // Lower case and without dashes still matches: the API normalises the code.
  const answer = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/auth/recovery");
  await submitRecoveryCode(page, "en", codes[3]!.replaceAll("-", "").toLowerCase());
  // The answer's body is pinned to exactly { redirect } by api/test/recovery.test.ts; the page navigates before
  // it could be read here.
  expect((await answer).status()).toBe(200);
  await expect(page).toHaveURL(/\/en\/account\/recovery\/$/);
  await expect(page.getByRole("heading", { name: c.recoveryHeading })).toBeVisible();
  await expect(page.getByRole("heading", { name: c.replaceHeading })).toBeVisible();
  expect((await whoAmI(page)).scope).toBe("recovery"); // still the restricted session
});
