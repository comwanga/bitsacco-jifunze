import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { feedbackCopy, FEEDBACK_EMAIL } from "../lib/feedback";

for (const lang of ["sw", "en"] as const) {
  test(`${lang}: anonymous curriculum feedback exposes only static context and offers a keyboard-copy fallback`, async ({ page }) => {
    const c = feedbackCopy[lang], api: string[] = [];
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url()); });
    await page.goto(`/${lang}/savers/wallets-keys/?account=PRIVATE_QUERY#PRIVATE_FRAGMENT`);
    await page.evaluate(() => {
      localStorage.setItem("feedback-private-fixture", "PRIVATE_STORAGE_RECOVERY_KEY_PROGRESS");
      sessionStorage.setItem("feedback-private-fixture", "PRIVATE_SESSION");
    });
    const feedback = page.locator("main [data-feedback]");
    const link = feedback.getByRole("link", { name: c.send, exact: true });
    const href = (await link.getAttribute("href"))!;
    const mail = new URL(href);
    expect(mail.protocol).toBe("mailto:"); expect(mail.pathname).toBe(FEEDBACK_EMAIL);
    expect([...mail.searchParams.keys()]).toEqual(["subject", "body"]);
    expect(mail.searchParams.get("subject")).toContain(await page.locator("h1").innerText());
    expect(mail.searchParams.get("body")).toContain(`/${lang}/savers/wallets-keys/`);
    expect(decodeURIComponent(href)).not.toMatch(/PRIVATE_QUERY|PRIVATE_FRAGMENT|PRIVATE_STORAGE|PRIVATE_SESSION/);
    // Intercept at the DOM only: verify Enter activates a normal mailto without sending a test email.
    await link.evaluate((el) => el.addEventListener("click", (event) => { el.setAttribute("data-native-mailto", String(!event.defaultPrevented)); event.preventDefault(); }));
    await link.focus(); await expect(link).toBeFocused(); await page.keyboard.press("Enter");
    await expect(link).toHaveAttribute("data-native-mailto", "true");
    const copy = feedback.getByRole("button", { name: c.copy, exact: true });
    await copy.focus(); await page.keyboard.press("Enter");
    const address = feedback.getByRole("textbox", { name: c.email, exact: true });
    await expect(address).toHaveValue(FEEDBACK_EMAIL); await expect(address).toHaveAttribute("readonly", "");
    await address.focus(); await page.keyboard.press("ControlOrMeta+A");
    expect(await address.evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0))).toBe(FEEDBACK_EMAIL);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include("main [data-feedback]").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.goto(`/${lang}/savers/`);
    expect(new URL((await page.locator("main [data-feedback] a").getAttribute("href"))!).searchParams.get("body")).toContain(`/${lang}/savers/`);
    await page.goto(`/${lang}/`);
    await expect(page.locator("footer").getByRole("link", { name: c.send, exact: true })).toBeVisible();
    await page.locator("footer").getByRole("button", { name: c.copy, exact: true }).click();
    await expect(page.locator("footer").getByRole("textbox", { name: c.email, exact: true })).toHaveValue(FEEDBACK_EMAIL);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(api).toEqual([]);
  });

  test(`${lang}: feedback and address fallback work with JavaScript disabled`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage(), c = feedbackCopy[lang];
      await page.goto(`/${lang}/`);
      await expect(page.locator("footer").getByRole("link", { name: c.send, exact: true })).toHaveAttribute("href", /^mailto:/);
      await page.locator("footer").getByRole("button", { name: c.copy, exact: true }).click();
      await expect(page.locator("footer").getByRole("textbox", { name: c.email, exact: true })).toHaveValue(FEEDBACK_EMAIL);
    } finally { await context.close(); }
  });
}

for (const lang of ["sw", "en"] as const) {
  test(`${lang}: the header offers feedback where the account link used to be, on wide and phone screens`, async ({ page }) => {
    const c = feedbackCopy[lang], api: string[] = [];
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url()); });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/${lang}/savers/wallets-keys/?account=PRIVATE_QUERY#PRIVATE_FRAGMENT`);
    const wide = page.locator("header [data-header-feedback]:visible");
    await expect(wide).toHaveCount(1); await expect(wide).toHaveText(c.send);
    const mail = new URL((await wide.getAttribute("href"))!);
    expect(mail.protocol).toBe("mailto:"); expect(mail.pathname).toBe(FEEDBACK_EMAIL);
    expect([...mail.searchParams.keys()]).toEqual(["subject", "body"]);
    expect(decodeURIComponent(mail.href)).not.toMatch(/PRIVATE|wallets-keys/); // the shared header carries no page or learner context
    await wide.focus(); await expect(wide).toBeFocused();
    await expect(page.locator('a[href*="/account/"]')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("header [data-header-feedback]:visible")).toHaveCount(0); // inside the closed menu
    await page.locator("header summary").click();
    const inMenu = page.locator("header nav [data-header-feedback]:visible");
    await expect(inMenu).toHaveCount(1); await expect(inMenu).toHaveText(c.send);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(api).toEqual([]);
  });
}
