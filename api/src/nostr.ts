import { createHash } from "node:crypto";
import { schnorr } from "@noble/curves/secp256k1.js";
import { ApiError } from "./errors.ts";

export type NostrEvent = {
  id: string; pubkey: string; sig: string; created_at: number; kind: number; tags: string[][]; content: string;
};
type EventData = Pick<NostrEvent, "pubkey" | "created_at" | "kind" | "tags" | "content">;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const sha256 = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

// Promoted from the approved spike: NIP-01 escapes only these seven characters.
function nip01String(s: string): string {
  const escapes: Record<string, string> = { "\n": "\\n", '"': '\\"', "\\": "\\\\", "\r": "\\r", "\t": "\\t", "\b": "\\b", "\f": "\\f" };
  return '"' + s.replace(/[\n"\\\r\t\b\f]/g, (ch) => escapes[ch]!) + '"';
}
export function serialize(e: EventData): string {
  const tags = "[" + e.tags.map((t) => "[" + t.map(nip01String).join(",") + "]").join(",") + "]";
  return `[0,${nip01String(e.pubkey)},${e.created_at},${e.kind},${tags},${nip01String(e.content)}]`;
}
export const eventId = (e: EventData): string => sha256(serialize(e));

/** Pure verification: no database writes. Only a proven event may reach challenge consumption. */
export function verifyNostr(authorization: string | undefined, raw: Buffer, url: string, now = Math.floor(Date.now() / 1000)): string {
  const invalid = () => new ApiError(401, "nostr_invalid");
  if (!authorization || authorization.length > 8192 || !authorization.startsWith("Nostr ")) throw invalid();
  const b64 = authorization.slice(6);
  // Buffer's decoder alone accepts invalid characters and noncanonical encodings.
  if (!b64 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw invalid();
  const decoded = Buffer.from(b64, "base64");
  if (decoded.toString("base64") !== b64) throw invalid();
  let e: NostrEvent;
  try { e = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded)); } catch { throw invalid(); }
  if (!e || typeof e !== "object" || Array.isArray(e)) throw invalid();
  if (Object.keys(e).some((key) => !["id", "pubkey", "sig", "created_at", "kind", "tags", "content"].includes(key))) throw invalid();
  if (typeof e.id !== "string" || !HEX64.test(e.id) || typeof e.pubkey !== "string" || !HEX64.test(e.pubkey)
    || typeof e.sig !== "string" || !HEX128.test(e.sig)) throw invalid();
  if (!Number.isSafeInteger(e.created_at) || e.created_at < 0 || !Number.isSafeInteger(e.kind) || e.kind !== 27235) throw invalid();
  if (!Array.isArray(e.tags) || !e.tags.every((t) => Array.isArray(t) && t.length > 0 && t.every((v) => typeof v === "string"))) throw invalid();
  if (e.content !== "" || eventId(e) !== e.id) throw invalid();
  let valid = false;
  try { valid = schnorr.verify(Buffer.from(e.sig, "hex"), Buffer.from(e.id, "hex"), Buffer.from(e.pubkey, "hex")); } catch { /* invalid point */ }
  if (!valid) throw invalid();
  if (Math.abs(now - e.created_at) > 60) throw new ApiError(401, "nostr_expired");
  for (const [name, value] of [["u", url], ["method", "POST"], ["payload", sha256(raw)]]) {
    const tags = e.tags.filter((t) => t[0] === name);
    if (tags.length !== 1 || tags[0]!.length !== 2 || tags[0]![1] !== value) throw invalid();
  }
  if (raw.length === 0) throw invalid();
  return e.pubkey;
}
