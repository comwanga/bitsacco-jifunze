import { createHash } from "node:crypto";
import { schnorr } from "@noble/curves/secp256k1.js";
import { eventId, type NostrEvent } from "../src/nostr.ts";

export const testKey = new Uint8Array(32).fill(7); // test only, never used outside tests
export function signedEvent(raw: Uint8Array, url: string, now = Math.floor(Date.now() / 1000), over: Record<string, unknown> = {}, extra: string[][] = [], key = testKey): NostrEvent {
  const e = {
    pubkey: Buffer.from(schnorr.getPublicKey(key)).toString("hex"), created_at: now, kind: 27235, content: "",
    tags: [["u", url], ["method", "POST"], ["payload", createHash("sha256").update(raw).digest("hex")], ...extra],
    ...over,
  } as NostrEvent;
  e.id = eventId(e);
  e.sig = Buffer.from(schnorr.sign(Buffer.from(e.id, "hex"), key)).toString("hex");
  return e;
}
export const header = (event: unknown) => "Nostr " + Buffer.from(JSON.stringify(event)).toString("base64");
