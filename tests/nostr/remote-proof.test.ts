import { afterEach, expect, test, vi } from "vitest";
import { prepareProof } from "../../components/account/nostr-proof";
import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";
const origin = "https://jifunze.example", key = generateSecretKey();
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function fixture() {
  vi.stubGlobal("window", { location: { origin } });
  const fetch = vi.fn(async (_path: string, _init: RequestInit) => new Response(JSON.stringify({ challengeId: "challenge", nonce: "nonce", url: origin + "/api/auth/nostr/verify" }), { status: 200 }));
  vi.stubGlobal("fetch", fetch); return fetch;
}
test("remote proof retains account condition and forwards only public fields", async () => {
  const fetch = fixture();
  const p = await prepareProof("signin", "en", "anonymous", { remote: true }); expect(p.ok).toBe(true); if (!p.ok) return;
  await p.data.complete({ signEvent: async (t) => ({ ...finalizeEvent(t, key), secret: "never-forward" }) }, () => {});
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [, init] of fetch.mock.calls) expect(init.headers).toMatchObject({ "X-Jifunze-Account": "anonymous" });
  expect(JSON.parse(String(fetch.mock.calls[0][1].body)).remote).toBe(true);
  expect(JSON.stringify(fetch.mock.calls)).not.toContain("never-forward");
});
test("cancellation ignores a late signer response and never submits it", async () => {
  const fetch = fixture(), control = new AbortController();
  const p = await prepareProof("signin", "en", "acct-a", { remote: true, signal: control.signal }); if (!p.ok) throw new Error("fixture");
  let release!: () => void;
  const result = p.data.complete({ signEvent: async (t) => { await new Promise<void>((r) => { release = r; }); return finalizeEvent(t, key); } }, () => {});
  await vi.waitFor(() => expect(release).toBeTypeOf("function")); control.abort(); release();
  expect((await result).ok).toBe(false); expect(fetch).toHaveBeenCalledTimes(1);
});
test("expired and repeated attempts cannot submit a session proof", async () => {
  const fetch = fixture(); vi.useFakeTimers();
  const p = await prepareProof("signin", "en", "anonymous", { remote: true }); if (!p.ok) throw new Error("fixture");
  vi.setSystemTime(Date.now() + 120_001);
  const signer = { signEvent: vi.fn(async (t) => finalizeEvent(t, key)) };
  expect((await p.data.complete(signer, () => {})).ok).toBe(false);
  expect(signer.signEvent).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
});
test("mutated destination or timestamp cannot reach HTTP verification", async () => {
  const fetch = fixture();
  const p = await prepareProof("signin", "en"); if (!p.ok) throw new Error("fixture");
  const signer = { signEvent: vi.fn(async (t) => finalizeEvent({ ...t, created_at: t.created_at - 1 }, key)) };
  expect((await p.data.complete(signer, () => {})).ok).toBe(false);
  expect((await p.data.complete(signer, () => {})).ok).toBe(false);
  expect(signer.signEvent).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(1);
});
