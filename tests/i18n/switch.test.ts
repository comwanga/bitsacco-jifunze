import { expect, test } from "vitest";
import { switchHref } from "../../lib/i18n.ts";

test("switchHref keeps the page and swaps the language", () => {
  expect(switchHref("/sw/savers/wallets-keys/", "en")).toBe("/en/savers/wallets-keys/");
  expect(switchHref("/en/", "sw")).toBe("/sw/");
  expect(switchHref("/sw", "en")).toBe("/en/");
  expect(switchHref("/", "en")).toBe("/en/");
  expect(switchHref("/sw/glossary/", "en")).toBe("/en/glossary/");
});
