import { afterEach, expect, test, vi } from "vitest";
import { BunkerSigner } from "nostr-tools/nip46";
import { getPublicKey } from "nostr-tools/pure";
import { remoteAttempt } from "../../lib/nostr/remote";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

test("cancel closes the owned pool, erases the client key, and ignores a late connection", async () => {
  let key!: Uint8Array, finish!: (value: BunkerSigner) => void;
  let destroy!: ReturnType<typeof vi.spyOn>;
  vi.spyOn(BunkerSigner, "fromURI").mockImplementation((k, _uri, params) => {
    key = k; destroy = vi.spyOn(params!.pool!, "destroy");
    return new Promise((resolve) => { finish = resolve; });
  });
  const attempt = remoteAttempt("https://jifunze.example");
  expect(key.some(Boolean)).toBe(true); expect(attempt.uri).toMatch(/^nostrconnect:/);
  attempt.close(); attempt.close();
  expect(key.every((n) => n === 0)).toBe(true); expect(attempt.uri).toBe(""); expect(destroy).toHaveBeenCalledTimes(1);
  await expect(attempt.ready).rejects.toMatchObject({ reason: "cancelled" });
  const conversation = new Uint8Array(32).fill(9), close = vi.fn(async () => {});
  finish({ close, conversationKey: conversation, listeners: {}, waitingForAuth: {}, bp: { relays: ["wss://relay.nsec.app/"], secret: "fixture", pubkey: "a".repeat(64) } } as unknown as BunkerSigner);
  await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1)); expect(conversation.every((n) => n === 0)).toBe(true);
});

test("a suspended attempt expires by elapsed time and erases its credentials", async () => {
  vi.useFakeTimers(); let key!: Uint8Array;
  vi.spyOn(BunkerSigner, "fromURI").mockImplementation((k) => { key = k; return new Promise(() => {}); });
  const attempt = remoteAttempt("https://jifunze.example");
  await vi.advanceTimersByTimeAsync(120_001);
  await expect(attempt.ready).rejects.toMatchObject({ reason: "timeout" });
  expect(attempt.signal.aborted).toBe(true); expect(key.every((n) => n === 0)).toBe(true); expect(attempt.uri).toBe("");
});

test("pinned SDK cleanup fields exist and derived key buffers can be erased", async () => {
  const key = new Uint8Array(32).fill(7), peer = getPublicKey(new Uint8Array(32).fill(8));
  const pool = { subscribe: () => ({ close: () => {} }) };
  const signer = BunkerSigner.fromBunker(key, { pubkey: peer, relays: ["wss://relay.nsec.app/"], secret: "fixture" }, { pool: pool as never });
  const state = signer as unknown as { conversationKey: Uint8Array; secretKey: Uint8Array; listeners: object; waitingForAuth: object };
  expect(state.secretKey).toBe(key); expect(state.conversationKey).toBeInstanceOf(Uint8Array);
  expect(state.listeners).toEqual({}); expect(state.waitingForAuth).toEqual({});
  await signer.close(); state.conversationKey.fill(0); key.fill(0);
});
