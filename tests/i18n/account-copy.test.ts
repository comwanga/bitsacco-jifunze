import { expect, test } from "vitest";
import { MESSAGES } from "../../api/src/errors.ts";
import { accountCopy, errorText } from "../../lib/account-copy.ts";
import { nostrOnboardingCopy } from "../../lib/nostr-onboarding-copy.ts";
import { syncCopy } from "../../lib/sync-copy.ts";
import { accountSecurityCopy } from "../../lib/account-security-copy.ts";
import { learningIdentityCopy } from "../../lib/learning-identity-copy.ts";

test("learning identity copy has complete nonempty bilingual parity", () => {
  expect(Object.keys(learningIdentityCopy.en).sort()).toEqual(Object.keys(learningIdentityCopy.sw).sort());
  for (const copy of Object.values(learningIdentityCopy)) expect(Object.values(copy).every((v) => v.trim())).toBe(true);
});

test("Nostr onboarding copy has complete nonempty bilingual parity", () => {
  expect(Object.keys(nostrOnboardingCopy.en).sort()).toEqual(Object.keys(nostrOnboardingCopy.sw).sort());
  for (const copy of Object.values(nostrOnboardingCopy)) expect(Object.values(copy).every((v) => v.trim())).toBe(true);
});

test("account copy has complete matching nonempty language keys", () => {
  expect(Object.keys(accountCopy.en).sort()).toEqual(Object.keys(accountCopy.sw).sort());
  for (const copy of Object.values(accountCopy)) expect(Object.values(copy).every((v) => typeof v === "string" && v.trim())).toBe(true);
});

test("every API error code has its own Kiswahili and English message", () => {
  const codes = Object.keys(MESSAGES);
  expect(codes.length).toBeGreaterThan(0);
  for (const code of codes) {
    for (const lang of ["sw", "en"] as const) {
      const key = `error_${code}` as keyof (typeof accountCopy)["en"];
      expect(accountCopy[lang][key], `${lang} ${code}`).toBeTruthy();
      expect(errorText(lang, code)).toBe(accountCopy[lang][key]);
    }
  }
});

test("an unknown error code falls back to the general message", () => {
  expect(errorText("sw", "something_new")).toBe(accountCopy.sw.error_internal);
  expect(errorText("en", null)).toBe(accountCopy.en.error_internal);
});

test("progress sync copy has complete matching nonempty language keys", () => {
  expect(Object.keys(syncCopy.en).sort()).toEqual(Object.keys(syncCopy.sw).sort());
  for (const copy of Object.values(syncCopy)) expect(Object.values(copy).every((v) => typeof v === "string" && v.trim())).toBe(true);
});

test("account security copy has complete nonempty bilingual parity", () => {
  expect(Object.keys(accountSecurityCopy.en).sort()).toEqual(Object.keys(accountSecurityCopy.sw).sort());
  for (const copy of Object.values(accountSecurityCopy)) expect(Object.values(copy).every((v) => v.trim())).toBe(true);
});
