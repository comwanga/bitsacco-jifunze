import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { simulatedSigner } from "./signer";
import { remoteSigningCopy } from "../lib/remote-signing-copy";
import { accountCopy } from "../lib/account-copy";
import { accountSecurityCopy } from "../lib/account-security-copy";
import { finishWelcome, SESSION_COOKIE, whoAmI } from "../e2e-account/helpers";
import { signedEvent } from "../api/test/nostr-helper";
import { generateSecretKey } from "nostr-tools/pure";

type Simulator = Awaited<ReturnType<typeof simulatedSigner>>;
async function entry(page: Page, lang: "en" | "sw" = "en") {
  const c = remoteSigningCopy[lang];
  await page.goto(`/${lang}/account/signin/#own`);
  await page.getByRole("button", { name: c.choose, exact: true }).click();
  await expect(page.getByRole("heading", { name: c.heading })).toBeFocused();
}
async function pair(page: Page, signer: Simulator, lang: "en" | "sw" = "en") {
  const c = remoteSigningCopy[lang];
  await page.getByRole("button", { name: c.start, exact: true }).click();
  const link = page.getByRole("link", { name: c.open, exact: true });
  await expect(link).toBeVisible(); const uri = await link.getAttribute("href");
  await signer.pair(uri!); return uri!;
}
async function browserIdentity(page: Page, key = generateSecretKey()) {
  await page.exposeFunction("remoteTestNip07", (event: { created_at: number }) => signedEvent(new Uint8Array(), "", event.created_at, event, [], new Uint8Array(key)));
  await page.addInitScript(() => Object.assign(window, { nostr: { signEvent: (event: unknown) => (window as unknown as { remoteTestNip07: (t: unknown) => Promise<unknown> }).remoteTestNip07(event) } }));
  return key;
}

for (const lang of ["en", "sw"] as const) {
  test(`${lang}: QR/app pairing authenticates through real NIP-98, accessible mobile UI and clean credentials`, async ({ page, context, request }) => {
    const c = remoteSigningCopy[lang], scripts = new Set<string>(), api: string[] = [], sockets: string[] = [];
    context.on("request", (r) => { if (r.resourceType() === "script") scripts.add(new URL(r.url()).pathname); if (r.url().includes("/api/")) api.push(r.url()); });
    page.on("websocket", (s) => sockets.push(s.url()));
    const consoleText: string[] = []; page.on("console", (m) => consoleText.push(m.text()));
    const remote = await simulatedSigner(context);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/${lang}/account/signin/#own`);
    expect(api).toEqual([]); expect(sockets).toEqual([]);
    for (const script of scripts) expect(await (await request.get(script)).text()).not.toContain("switch_relays");
    await page.getByRole("button", { name: c.choose }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: c.heading })).toBeFocused();
    await page.getByRole("button", { name: c.start }).click();
    const link = page.getByRole("link", { name: c.open }); await expect(link).toBeVisible();
    await expect(page.getByRole("img", { name: c.qr })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`${lang}-pairing-mobile.png`), fullPage: true });
    const uri = (await link.getAttribute("href"))!;
    await remote.pair(uri, true); await expect(page.getByRole("status").filter({ hasText: c.waiting })).toBeVisible();
    await remote.pair(uri);
    await expect(page.locator("[data-codes] li")).toHaveCount(10);
    await finishWelcome(page, lang);
    expect(remote.requests).toEqual(["switch_relays", "get_public_key", "sign_event"]);
    await expect.poll(() => remote.sockets.size).toBe(0);
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).not.toContain(new URL(uri).searchParams.get("secret")!);
    expect(storage).not.toMatch(/nostrconnect|bunker:\/\//);
    // The rejected wrong-secret pairing above must not reach the SDK's warning path either.
    expect(consoleText.join("\n")).not.toMatch(/nostrconnect|secret|wss:|NOTICE/i);
    expect(consoleText.join("\n")).not.toContain(new URL(uri).searchParams.get("secret")!);
    expect(await whoAmI(page)).toMatchObject({ scope: "full" });
  });
}

test("bunker connection validates a signed proof and cleans up", async ({ page, context }) => {
  const remote = await simulatedSigner(context), c = remoteSigningCopy.en;
  await entry(page); await page.getByText(c.bunker, { exact: true }).click();
  await page.getByLabel(c.address, { exact: true }).fill(remote.bunker());
  await page.getByRole("button", { name: c.bunkerStart }).click();
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  await expect.poll(() => remote.sockets.size).toBe(0);
  expect(remote.requests).toEqual(["connect", "switch_relays", "get_public_key", "sign_event"]);
});

test("a bunker address with one unreachable relay still signs in through the other", async ({ page, context }) => {
  const remote = await simulatedSigner(context), c = remoteSigningCopy.en; remote.unreachable("down.nsec.app");
  await entry(page); await page.getByText(c.bunker, { exact: true }).click();
  await page.getByLabel(c.address, { exact: true }).fill(remote.bunker(["wss://down.nsec.app/", "wss://relay.nsec.app/"]));
  await page.getByRole("button", { name: c.bunkerStart }).click();
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  expect(remote.urls).toContain("wss://down.nsec.app/");
  await expect.poll(() => remote.sockets.size).toBe(0);
});

test("with no signer app and one pairing relay unreachable, the link leaves the attempt running and pairing still completes", async ({ page, context }) => {
  const remote = await simulatedSigner(context), c = remoteSigningCopy.en; remote.unreachable("relay.nsec.app");
  await entry(page); await page.getByRole("button", { name: c.start, exact: true }).click();
  const link = page.getByRole("link", { name: c.open, exact: true }); await expect(link).toBeVisible();
  await expect(page.getByText(c.noApp, { exact: true })).toBeVisible();
  const uri = (await link.getAttribute("href"))!;
  expect(new URL(uri).searchParams.getAll("relay")).toEqual(["wss://relay.nsec.app/", "wss://relay.primal.net/"]);
  await link.click(); // headless Chromium has no handler for the scheme, like a phone without a signer app
  await expect(link).toBeVisible(); await expect(page.getByRole("status").filter({ hasText: c.waiting })).toBeVisible();
  await remote.pair(uri);
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  await expect.poll(() => remote.sockets.size).toBe(0);
});

test("a mistyped bunker address is refused before any connection, with a plain message", async ({ page, context }) => {
  const remote = await simulatedSigner(context), c = remoteSigningCopy.en;
  await entry(page); await page.getByText(c.bunker, { exact: true }).click();
  await page.getByLabel(c.address, { exact: true }).fill("nsec1notanaddress");
  await page.getByRole("button", { name: c.bunkerStart }).click();
  await expect(page.locator("[data-remote-signing] [role=alert]")).toHaveText(c.badAddress);
  expect(remote.urls).toEqual([]); expect(await page.getByLabel(c.address, { exact: true }).inputValue()).toBe("");
});

test("only the two sign-in pages of the export may open relay WebSockets", () => {
  const pages = (fs.readdirSync("out", { recursive: true }) as string[]).filter((f) => f.endsWith(".html")).map((f) => f.replaceAll("\\", "/"));
  const allowed = pages.filter((f) => /connect-src[^;"]*wss:/.test(fs.readFileSync(`out/${f}`, "utf8")));
  expect(pages.length).toBeGreaterThan(100);
  expect(allowed.sort()).toEqual(["en/account/signin/index.html", "sw/account/signin/index.html"]);
});

test("a signer's validated relay switch keeps the attempt alive and closes every socket afterwards", async ({ page, context }) => {
  const remote = await simulatedSigner(context); remote.mode("switch");
  await entry(page); await pair(page, remote);
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  expect(remote.urls).toContain("wss://relay2.nsec.app/");
  expect(remote.requests.filter((m) => m === "sign_event")).toHaveLength(1);
  await expect.poll(() => remote.sockets.size).toBe(0);
});

for (const mode of ["bad-signature", "wrong-identity", "decline", "unsafe-switch"] as const) {
  test(`rejects ${mode} without establishing a session`, async ({ page, context }) => {
    const remote = await simulatedSigner(context); remote.mode(mode);
    let verifies = 0; page.on("request", (r) => { if (r.url().endsWith("/api/auth/nostr/verify")) verifies++; });
    await entry(page); await pair(page, remote);
    await expect(page.locator("[data-remote-signing] [role=alert]")).toBeVisible();
    expect(verifies).toBe(0);
    await expect.poll(() => remote.sockets.size).toBe(0);
    expect((await context.request.get("/api/me")).status()).toBe(401);
  });
}

test("cancelled pairing ignores a late response; retry has new credentials and only one signature", async ({ page, context }) => {
  const remote = await simulatedSigner(context), c = remoteSigningCopy.en;
  await entry(page); await page.getByRole("button", { name: c.start }).click();
  const uri = (await page.getByRole("link", { name: c.open }).getAttribute("href"))!;
  await page.getByRole("button", { name: c.cancel }).click();
  await expect.poll(() => remote.sockets.size).toBe(0);
  expect((await context.request.get("/api/me")).status()).toBe(401);
  await page.getByRole("button", { name: c.choose }).click();
  await page.getByRole("button", { name: c.start }).dblclick();
  const next = (await page.getByRole("link", { name: c.open }).getAttribute("href"))!;
  expect(new URL(uri).hostname).not.toBe(new URL(next).hostname);
  await remote.pair(uri, false, false); // old recipient has no subscription
  await remote.pair(next);
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  expect(remote.requests.filter((m) => m === "sign_event")).toHaveLength(1);
});

test("late signatures after cancellation never verify; a disconnected relay permits a fresh retry", async ({ page, context }) => {
  const remote = await simulatedSigner(context), c = remoteSigningCopy.en; remote.mode("hold");
  let verifies = 0; page.on("request", (r) => { if (r.url().endsWith("/api/auth/nostr/verify")) verifies++; });
  await entry(page); await pair(page, remote);
  await expect.poll(() => remote.requests.includes("sign_event")).toBe(true);
  await page.getByRole("button", { name: c.cancel }).click(); remote.release();
  expect(verifies).toBe(0); await expect.poll(() => remote.sockets.size).toBe(0);
  await page.getByRole("button", { name: c.choose }).click(); await page.getByRole("button", { name: c.start }).click();
  await expect(page.getByRole("link", { name: c.open })).toBeVisible(); remote.disconnect();
  await expect(page.locator("[data-remote-signing] [role=alert]")).toHaveText(c.disconnected);
  remote.mode("approve"); await pair(page, remote);
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
});

test("timeout clears credentials and an expired challenge cannot establish a session", async ({ page, context }) => {
  const remote = await simulatedSigner(context), c = remoteSigningCopy.en;
  await entry(page); await page.clock.install(); await page.getByRole("button", { name: c.start }).click();
  await expect(page.getByRole("link", { name: c.open })).toBeVisible();
  await page.clock.fastForward(120_001);
  await expect(page.locator("[data-remote-signing] [role=alert]")).toHaveText(c.timeout);
  await expect.poll(() => remote.sockets.size).toBe(0);
  expect((await context.request.get("/api/me")).status()).toBe(401);
});

test("a session appearing during remote sign-in cannot be replaced by its late signature", async ({ page, context }) => {
  const remote = await simulatedSigner(context); remote.mode("hold");
  await entry(page); await pair(page, remote);
  await expect.poll(() => remote.requests.includes("sign_event")).toBe(true);
  const other = await context.newPage(); await browserIdentity(other);
  await other.goto("/en/account/signin/#own"); await other.getByRole("button", { name: accountCopy.en.continueNostr }).click();
  await expect(other.locator("[data-codes] li")).toHaveCount(10); const current = await whoAmI(other);
  remote.release();
  await expect(page.locator("[data-remote-signing] [role=alert]")).toHaveText(accountCopy.en.error_account_changed);
  expect((await whoAmI(other)).id).toBe(current.id);
});

test("a learner switch during popup signing is refused by the server and leaves the new learner untouched", async ({ page, context, browser }) => {
  const key = await browserIdentity(page), remote = await simulatedSigner(context); remote.use(key);
  await page.goto("/en/account/signin/#own"); await page.getByRole("button", { name: accountCopy.en.continueNostr }).click();
  await expect(page.locator("[data-codes] li")).toHaveCount(10); await finishWelcome(page, "en");
  const occupied = await browser.newContext(), other = await occupied.newPage(); await browserIdentity(other);
  await other.goto("/en/account/signin/#own"); await other.getByRole("button", { name: accountCopy.en.continueNostr }).click();
  await expect(other.locator("[data-codes] li")).toHaveCount(10); const second = await whoAmI(other);
  const s = accountSecurityCopy.en, c = remoteSigningCopy.en; remote.mode("hold");
  await page.getByRole("button", { name: accountCopy.en.newCodes, exact: true }).click();
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: c.sensitive }).click(); const popup = await popupPromise;
  await pair(popup, remote);
  await expect.poll(() => remote.requests.includes("sign_event")).toBe(true);
  // Only the session cookie changes: the first learner's challenge cookie and valid signature still arrive.
  await context.addCookies((await occupied.cookies()).filter((k) => k.name === SESSION_COOKIE));
  const rejection = page.waitForResponse((r) => r.url().endsWith("/api/auth/nostr/reauth"));
  remote.release();
  expect((await rejection).status()).toBe(409);
  expect((await (await rejection).json()).error.code).toBe("account_changed");
  await expect(page.getByText(s.accountChanged)).toBeVisible();
  await expect(page.getByText(s.confirmed, { exact: true })).toHaveCount(0);
  expect((await whoAmI(other)).id).toBe(second.id); await expect.poll(() => remote.sockets.size).toBe(0);
  await occupied.close();
});

test("account reauthentication uses the existing identity and retains the account condition through popup signing", async ({ page, context }) => {
  const key = await browserIdentity(page), remote = await simulatedSigner(context); remote.use(key);
  await page.goto("/en/account/signin/#own"); await page.getByRole("button", { name: accountCopy.en.continueNostr }).click();
  await expect(page.locator("[data-codes] li")).toHaveCount(10); await finishWelcome(page, "en");
  const before = await whoAmI(page), s = accountSecurityCopy.en, c = remoteSigningCopy.en;
  await page.getByRole("button", { name: accountCopy.en.newCodes, exact: true }).click();
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: c.sensitive }).click(); const popup = await popupPromise;
  await expect(popup.getByRole("heading", { name: c.heading })).toBeVisible(); await pair(popup, remote);
  await expect(page.getByText(s.confirmed, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: accountCopy.en.newCodesConfirm, exact: true }).click();
  await expect(page.locator("[data-codes] li")).toHaveCount(10);
  expect((await whoAmI(page)).id).toBe(before.id); await expect.poll(() => remote.sockets.size).toBe(0);
});
