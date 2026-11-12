import { afterEach, expect, test, vi } from "vitest";
import { feedbackHref, feedbackRecipient } from "../lib/feedback";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

test("feedback recipient is one public configurable mailbox, never injected mail headers", async () => {
  expect(feedbackRecipient(undefined)).toBe("mwanga@bitsacco.com");
  expect(feedbackRecipient("learners+test@example.org")).toBe("learners+test@example.org");
  for (const value of ["a@example.org?bcc=other@example.org", "a@example.org\r\nBcc: other@example.org", "a@example.org,other@example.org", "Name <a@example.org>", "not-an-address"]) {
    expect(() => feedbackRecipient(value)).toThrow("JIFUNZE_FEEDBACK_EMAIL");
  }
  vi.stubEnv("JIFUNZE_FEEDBACK_EMAIL", "learners@example.org");
  vi.resetModules();
  const configured = await import("../lib/feedback");
  expect(configured.feedbackHref("sw")).toMatch(/^mailto:learners@example.org\?/);
});

test("curriculum-only context is encoded once and accepts no query, account route or external URL", () => {
  for (const lang of ["en", "sw"] as const) {
    const url = new URL(feedbackHref(lang, { pathTitle: "Savings & Bitcoin", lessonTitle: "Keys + safety?", pathname: `/${lang}/savers/wallets-keys/` }));
    expect([...url.searchParams.keys()]).toEqual(["subject", "body"]);
    expect(url.searchParams.get("subject")).toContain("Keys + safety?");
    expect(url.searchParams.get("body")).toContain("Savings & Bitcoin");
    expect(url.searchParams.get("body")).toContain(`/${lang}/savers/wallets-keys/`);
    for (const pathname of [`/${lang}/savers/wallets-keys/?account=private`, `/${lang}/savers/wallets-keys/#private`, `/${lang}/account/`, "https://elsewhere.example/en/savers/"]) {
      expect(() => feedbackHref(lang, { pathTitle: "Savings", pathname })).toThrow("public learning path");
    }
  }
});

test("content titles cannot introduce subject headers", () => {
  const url = new URL(feedbackHref("en", { pathTitle: "Savings", lessonTitle: "Safety\r\nBcc: other@example.org", pathname: "/en/savers/wallets-keys/" }));
  expect(url.searchParams.get("subject")).not.toMatch(/[\r\n]/);
});
