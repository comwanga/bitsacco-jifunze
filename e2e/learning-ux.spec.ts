import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";

async function expectPlaying(page: Page) {
  await expect(page.locator("[data-home-intro]")).toHaveClass(/intro-play/);
  await expect.poll(() => page.locator(".mb-sun").evaluate(el => getComputedStyle(el).animationName)).toBe("mb-sun-up");
  const sample = await page.locator(".mb-sun").evaluate(async el => {
    const animation = el.getAnimations()[0];
    const first = Number(animation.currentTime);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { first, next: Number(animation.currentTime), state: animation.playState };
  });
  expect(sample.state).toBe("running");
  expect(sample.next).toBeGreaterThan(sample.first);
}

test("the scene starts before hydration even when application scripts cannot load", async ({ page }) => {
  await page.route("**/_next/static/**/*.js", route => route.abort());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en/");
  await expectPlaying(page);
  expect(await page.getByRole("link", { name: "Start learning", exact: true }).evaluate(el => getComputedStyle(el).opacity)).toBe("1");
});

test("homepage replays on reload, client returns, another tab and a new session with old storage", async ({ page, context, browser }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en/");
  await expectPlaying(page);
  await page.evaluate(() => localStorage.setItem("jifunze:intro-seen", "1"));
  await page.reload();
  await expectPlaying(page);
  await page.evaluate(() => { (window as unknown as { spaProbe: number }).spaProbe = 123; });
  await page.getByRole("link", { name: "Browse all lessons", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/learn\/$/);
  await page.locator("header [data-brand]").click();
  await expectPlaying(page);
  expect(await page.evaluate(() => (window as unknown as { spaProbe: number }).spaProbe)).toBe(123);
  // A previous visit's timer must not settle this newer visit early.
  await expect(page.locator("[data-home-intro]")).not.toHaveClass(/intro-play/, { timeout: 7000 });
  await page.getByRole("link", { name: "Browse all lessons", exact: true }).click();
  await page.locator("header [data-brand]").click();
  await expectPlaying(page);
  const tab = await context.newPage();
  await tab.emulateMedia({ reducedMotion: "no-preference" });
  await tab.goto("/en/");
  await expectPlaying(tab);
  await tab.close();
  const session = await browser.newContext({ storageState: await context.storageState(), reducedMotion: "no-preference" });
  const fresh = await session.newPage();
  await fresh.goto("/en/");
  await expectPlaying(fresh);
  expect(await fresh.evaluate(() => localStorage.getItem("jifunze:intro-seen"))).toBe("1");
  await session.close();
});

test("reduced motion shows the final scene, including a preference change mid-play", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sw/");
  await expect(page.locator("[data-home-intro]")).not.toHaveClass(/intro-play/);
  expect(await page.locator(".mbuyu").evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expectPlaying(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-home-intro]")).not.toHaveClass(/intro-play/);
  expect(await page.locator(".mbuyu").evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test("animation works with blocked storage and keyboard access immediately settles it", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en/");
  await expectPlaying(page);
  const start = page.getByRole("link", { name: "Start learning", exact: true });
  expect(await start.evaluate(el => getComputedStyle(el).opacity)).toBe("1");
  await start.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Browse all lessons", exact: true })).toBeFocused();
  await expect(page.locator("[data-home-intro]")).toHaveClass(/intro-skip/);
  expect(await page.locator(".mbuyu").evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test("animation keeps layout stable and samples frames on a throttled phone", async ({ page, context }, info) => {
  test.skip(info.project.name !== "mobile", "phone rendering measurement");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en/");
  await expectPlaying(page);
  const metrics = await page.evaluate(async () => {
    let cls = 0;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) cls += shift.value;
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
    const frames: number[] = [];
    await new Promise<void>(resolve => {
      let previous = performance.now();
      const until = previous + 5500;
      const frame = (now: number) => { frames.push(now - previous); previous = now; if (now < until) requestAnimationFrame(frame); else resolve(); };
      requestAnimationFrame(frame);
    });
    observer.disconnect();
    frames.sort((a, b) => a - b);
    return { cls, frames: frames.length, medianMs: frames[Math.floor(frames.length * .5)], p95Ms: frames[Math.floor(frames.length * .95)] };
  });
  fs.writeFileSync(info.outputPath("animation-performance.json"), JSON.stringify(metrics, null, 2));
  console.log(`Homepage throttled mobile animation: ${JSON.stringify(metrics)}`);
  expect(metrics.cls).toBe(0);
  expect(metrics.frames).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await expect(page.locator("[data-home-intro]")).not.toHaveClass(/intro-play/);
  await page.screenshot({ path: info.outputPath("homepage.png"), fullPage: true });
});

for (const lang of ["en", "sw"] as const) {
  test(`${lang}: continuation uses full metadata estimate and preserves incomplete progress`, async ({ page }, info) => {
    const at = "2026-11-01T10:00:00.000Z";
    const progress = { app: "bitsacco-jifunze", version: 1, lessons: {
      "savers/money-and-bitcoin": { completedAt: at },
      "savers/sats-and-volatility": { quiz: { correct: 1, total: 4, at }, reflectedAt: at },
    } };
    await page.goto(`/${lang}/progress/`);
    await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(progress)) });
    await page.locator("header [data-brand]").click();
    const card = page.locator("[data-continue]");
    await expect(card).toContainText(lang === "en" ? "Sats, prices and volatility: saving in Bitcoin vs shillings" : "Sats, bei na kupanda na kushuka: kuweka akiba kwa Bitcoin na kwa shilingi");
    const duration = /^minutes: (\d+)$/m.exec(fs.readFileSync(`content/savers/${lang}/sats-and-volatility.mdx`, "utf8"))![1];
    await expect(card).toContainText(lang === "en" ? `Full lesson estimate: ${duration} minutes.` : `Makadirio ya somo zima: dakika ${duration}.`);
    await expect(card).toContainText(lang === "en" ? "You're making progress! Keep going." : "Unaendelea vizuri! Endelea kujifunza.");
    await expect(card.getByRole("link")).toHaveText(lang === "en" ? "Continue learning" : "Endelea kujifunza");
    await expect(card.getByRole("link")).toHaveAttribute("href", `/${lang}/savers/sats-and-volatility/`);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jifunze:progress:v1")!)) ).toEqual(progress);
    await page.reload();
    await expect(card).toContainText(lang === "en" ? "Full lesson estimate" : "Makadirio ya somo zima");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const result = await new AxeBuilder({ page }).include("[data-continue]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await card.screenshot({ path: info.outputPath("continue-learning.png") });
  });

  test(`${lang}: Tree is default; explicit List survives lesson navigation, reload and back`, async ({ page }) => {
    const tree = lang === "en" ? "Tree" : "Mti";
    const list = lang === "en" ? "List" : "Orodha";
    for (const id of ["savers", "lightning", "builders"]) {
      await page.goto(`/${lang}/${id}/`);
      await expect(page.getByRole("link", { name: tree, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".learning-tree").first()).toBeVisible();
    }
    await page.getByRole("link", { name: list, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${lang}/list/builders/$`));
    await expect(page.getByRole("link", { name: list, exact: true })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page.getByRole("link", { name: list, exact: true })).toHaveAttribute("aria-current", "page");
    await page.locator('main a[href="/' + lang + '/builders/dev-environment-regtest/"]').first().click();
    await page.locator('article a[href="/' + lang + '/builders/"]').click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/list/builders/$`));
    await expect(page.getByRole("link", { name: list, exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: tree, exact: true }).click();
    await expect(page.locator(".learning-tree").first()).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("link", { name: list, exact: true })).toHaveAttribute("aria-current", "page");
  });
}

test("both path views work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const lang of ["en", "sw"]) for (const id of ["savers", "builders", "lightning"]) {
    await page.goto(`/${lang}/${id}/`);
    await expect(page.locator(".learning-tree").first()).toBeVisible();
    await page.getByRole("link", { name: lang === "en" ? "List" : "Orodha", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/list/${id}/$`));
    await expect(page.locator(".learning-tree")).toHaveCount(0);
    await expect(page.getByRole("link", { name: lang === "en" ? "List" : "Orodha", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: lang === "en" ? "Tree" : "Mti", exact: true }).click();
    await expect(page.locator(".learning-tree").first()).toBeVisible();
  }
  await context.close();
});

test("missing, corrupt and fully completed progress never offers a completed lesson", async ({ page }) => {
  const lessons = Object.fromEntries(["savers", "builders", "lightning"].flatMap(id => fs.readdirSync(`content/${id}/en`).filter(f => f.endsWith(".mdx")).map(f => [`${id}/${f.slice(0, -4)}`, { completedAt: "2026-11-01T10:00:00Z" }])));
  for (const raw of [null, "{bad", JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": {} } }), JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons })]) {
    await page.goto("/en/");
    await page.evaluate(raw => raw === null ? localStorage.removeItem("jifunze:progress:v1") : localStorage.setItem("jifunze:progress:v1", raw), raw);
    await page.reload();
    await expect(page.locator("[data-continue]")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("jifunze:progress:v1"))).toBe(raw);
  }
});
