import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { eventId, serialize, verifyNostr } from "../src/nostr.ts";
import { header, signedEvent } from "./nostr-helper.ts";

const url = "https://jifunze.test/api/auth/nostr/verify";
const rawBody = Buffer.from('{"challengeId":"test","nonce":"test"}');
const now = 1_800_000_000;
const verify = (event: unknown, body = rawBody) => verifyNostr(header(event), body, url, now);

it("agrees with all 19 official BIP-340 vectors (including invalid points and signatures)", () => {
  const csv = readFileSync(new URL("./fixtures/bip340.csv", import.meta.url), "utf8");
  const rows = csv.trim().split(/\r?\n/).slice(1);
  expect(rows).toHaveLength(19);
  for (const row of rows) {
    const [index, , pubkey, , message, sig, expected] = row.split(",");
    let valid = false;
    try { valid = schnorr.verify(Buffer.from(sig!, "hex"), Buffer.from(message!, "hex"), Buffer.from(pubkey!, "hex")); } catch { /* invalid point */ }
    expect(valid, `BIP-340 vector ${index}`).toBe(expected === "TRUE");
  }
});

it("rejects the official NIP-98 illustrative example's incorrect canonical id", () => {
  const e = JSON.parse(readFileSync(new URL("./fixtures/nip98.json", import.meta.url), "utf8"));
  expect(eventId(e)).not.toBe(e.id);
});

it("recomputes canonical ids and verifies signatures of recorded relay events", () => {
  const events = JSON.parse(readFileSync(new URL("./fixtures/relay-events.json", import.meta.url), "utf8"));
  expect(events.length).toBeGreaterThan(0);
  for (const e of events) {
    expect(eventId(e)).toBe(e.id);
    expect(schnorr.verify(Buffer.from(e.sig, "hex"), Buffer.from(e.id, "hex"), Buffer.from(e.pubkey, "hex"))).toBe(true);
  }
});

it("preserves the approved NIP-01 seven escapes, Unicode and literal other controls", () => {
  const e = { pubkey: "a".repeat(64), created_at: 1, kind: 1, tags: [["t", "Mti 🌳"]], content: '\n"\\\r\t\b\f\u0001' };
  expect(serialize(e)).toBe('[0,"' + e.pubkey + '",1,1,[["t","Mti 🌳"]],"\\n\\"\\\\\\r\\t\\b\\f\u0001"]');
  const naive = createHash("sha256").update(JSON.stringify([0, e.pubkey, 1, 1, e.tags, e.content])).digest("hex");
  expect(eventId(e)).not.toBe(naive);
});

it("accepts a valid NIP-98 request and both inclusive 60-second limits", () => {
  for (const offset of [-60, 0, 60]) {
    const e = signedEvent(rawBody, url, now + offset);
    expect(verify(e)).toBe(e.pubkey);
  }
});

it.each([
  ["wrong kind", { kind: 22242 }], ["content", { content: "hello" }],
  ["old", { created_at: now - 61 }], ["future", { created_at: now + 61 }],
  ["wrong URL", { tags: [["u", "https://evil.test"], ["method", "POST"]] }],
  ["query URL", { tags: [["u", url + "?x=1"], ["method", "POST"]] }],
  ["wrong method", { tags: [["u", url], ["method", "GET"]] }],
  ["missing tags", { tags: [] }],
  ["duplicate URL", { extra: [["u", url]] }], ["duplicate method", { extra: [["method", "POST"]] }],
  ["duplicate payload", { extra: [["payload", "0".repeat(64)]] }],
  ["extra tag value", { extra: [["method", "POST", "GET"]] }],
] as const)("rejects signed %s", (_name, change) => {
  const { extra, ...over } = change as { extra?: string[][]; [key: string]: unknown };
  const e = signedEvent(rawBody, url, now, over, extra);
  expect(() => verify(e)).toThrow();
});

it.each([
  null, [], { id: [] }, { created_at: 1.5 }, { kind: -1 }, { created_at: Number.MAX_SAFE_INTEGER + 1 },
  { tags: [[]] }, { tags: [["u", null]] }, { tags: "u" }, { content: 1 }, { sig: "ff" },
  { id: "A".repeat(64) }, { pubkey: 1 },
  { nsec: "unexpected secret field" },
])("rejects malformed event %j", (change) => {
  const e = signedEvent(rawBody, url, now);
  const value = change && !Array.isArray(change) ? { ...e, ...change } : change;
  expect(() => verify(value)).toThrow();
});

it("rejects forged signatures, wrong ids and another key's signature", () => {
  const e = signedEvent(rawBody, url, now);
  expect(() => verify({ ...e, sig: "0".repeat(128) })).toThrow();
  expect(() => verify({ ...e, id: "0".repeat(64) })).toThrow();
  const other = signedEvent(rawBody, url, now, {}, [], schnorr.utils.randomSecretKey());
  expect(() => verify({ ...e, sig: other.sig })).toThrow();
});

it("hashes exact raw bytes and requires a payload", () => {
  const e = signedEvent(rawBody, url, now);
  expect(() => verify(e, Buffer.from(rawBody.toString() + " "))).toThrow();
  expect(() => verify(e, Buffer.alloc(0))).toThrow();
  const tags = e.tags.filter((t) => t[0] !== "payload");
  expect(() => verify(signedEvent(rawBody, url, now, { tags }))).toThrow();
});

it.each([undefined, "Bearer x", "Nostr !!!", "Nostr e30=", "Nostr " + "a".repeat(8192)])("rejects malformed/oversize authorization", (authorization) => {
  expect(() => verifyNostr(authorization, rawBody, url, now)).toThrow();
});
