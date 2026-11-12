import { afterEach, expect, test, vi } from "vitest";
import { signedEvent } from "../../api/test/nostr-helper.ts";
import { prove } from "../../components/account/nostr-proof.ts";

afterEach(() => { vi.unstubAllGlobals(); });
const origin = "https://local.test";
const challenge = (purpose = "reauth") => ({ challengeId: "fixture-id", nonce: "fixture-nonce", url: `${origin}/api/auth/nostr/${purpose}` });
const reply = (json: unknown) => new Response(JSON.stringify(json), { status: 200 });
function signer(signEvent: (e: unknown) => Promise<unknown>) {
  vi.stubGlobal("window", { location: { origin }, nostr: { signEvent } });
}

test("reauthentication sends only public fields over the exact challenge body and purpose URL", async () => {
  signer(async (e) => ({ ...signedEvent(new Uint8Array(), "", undefined, e as Record<string, unknown>), nsec: "must-never-leave-extension" }));
  const calls: { path: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (path: string, init: RequestInit) => {
    calls.push({ path, init });
    return calls.length === 1 ? reply(challenge()) : new Response(null, { status: 204 });
  });
  expect((await prove("reauth", "en", () => {}, "acct-a")).ok).toBe(true);
  expect(calls.map((c) => c.path)).toEqual(["/api/auth/nostr/challenge", "/api/auth/nostr/reauth"]);
  expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({ purpose: "reauth" });
  expect(JSON.parse(calls[1]!.init.body as string)).toEqual({ challengeId: "fixture-id", nonce: "fixture-nonce" });
  for (const call of calls) expect((call.init.headers as Record<string, string>)["X-Jifunze-Account"]).toBe("acct-a");
  const authorization = (calls[1]!.init.headers as Record<string, string>).Authorization!;
  const proof = JSON.parse(Buffer.from(authorization.slice(6), "base64").toString("utf8"));
  expect(Object.keys(proof).sort()).toEqual(["content", "created_at", "id", "kind", "pubkey", "sig", "tags"]);
  expect(proof.tags[0]).toEqual(["u", origin + "/api/auth/nostr/reauth"]);
  expect(JSON.stringify(calls)).not.toContain("must-never-leave-extension");
});

test("a challenge for another origin or purpose is refused before involving the signer", async () => {
  const sign = vi.fn(); signer(sign);
  const fetch = vi.fn(async () => reply(challenge("replace"))); vi.stubGlobal("fetch", fetch);
  expect(await prove("reauth", "sw", () => {})).toMatchObject({ ok: false, code: "nostr_invalid" });
  expect(sign).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
});

test("mutating the signable template cannot bypass field validation", async () => {
  signer(async (e) => {
    const event = e as Record<string, unknown>; event.tags = [["u", "https://other.test/"]];
    return signedEvent(new Uint8Array(), "", undefined, event);
  });
  const fetch = vi.fn(async () => reply(challenge())); vi.stubGlobal("fetch", fetch);
  expect(await prove("reauth", "en", () => {})).toMatchObject({ ok: false, code: "nostr_invalid" });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("missing and rejected signers do not post a proof", async () => {
  vi.stubGlobal("window", { location: { origin } });
  const fetch = vi.fn(async () => reply(challenge())); vi.stubGlobal("fetch", fetch);
  expect(await prove("reauth", "en", () => {})).toMatchObject({ ok: false, code: "no-signer" });
  expect(fetch).not.toHaveBeenCalled();
  signer(async () => { throw Object.assign(new Error("rejected"), { code: 4001 }); });
  expect(await prove("reauth", "en", () => {})).toMatchObject({ ok: false, code: "declined" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
