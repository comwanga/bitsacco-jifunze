import { expect, test } from "@playwright/test";
import { discussionCopy } from "../lib/discussion-copy";
import { t } from "../lib/i18n";

// The account sync must cost an anonymous learner nothing: no request to the account service, no sync code
// downloaded, and no sync state written, while progress is saved on the device exactly as before.
for (const lang of ["en", "sw"] as const) {
  test(`${lang}: anonymous learning makes no account request and never loads the sync code`, async ({ page, request }) => {
    const scripts = new Set<string>();
    const api: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/")) api.push(`${r.method()} ${u.pathname}`);
      if (u.pathname.startsWith("/_next/static/") && u.pathname.endsWith(".js")) scripts.add(u.pathname);
    });
    await page.goto(`/${lang}/savers/money-and-bitcoin/`);
    await page.getByRole("button", { name: discussionCopy[lang].confirm, exact: true }).click();
    await page.getByRole("button", { name: t(lang, "markComplete"), exact: true }).click();
    await expect(page.locator('p[aria-live="polite"]').filter({ hasText: t(lang, "markedComplete") })).toBeVisible();
    await page.goto(`/${lang}/`);
    await page.goto(`/${lang}/tree/savers/`);
    await page.waitForTimeout(3_000); // longer than the sync's debounce

    expect(api).toEqual([]);
    expect(scripts.size).toBeGreaterThan(0);
    for (const path of scripts) {
      const text = await (await request.get(path)).text();
      expect(text, `${path} carries the sync module`).not.toContain("jifunze:progress:owner");
    }
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain("jifunze:progress:v1");
    expect(keys.filter((k) => /^jifunze:(account|sync|progress:owner)/.test(k))).toEqual([]); // no sign-in marker, owner or unsent flag
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!).lessons["savers/money-and-bitcoin"]);
    expect(saved.completedAt).toBeTruthy();
    expect(saved.reflectedAt).toBeTruthy();
  });
}
