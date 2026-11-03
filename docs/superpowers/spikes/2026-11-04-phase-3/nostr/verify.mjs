// Spike: NIP-01 canonical serialization and NIP-98 login verification. Not application code.
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

/** NIP-01: escape exactly \n " \\ \r \t \b \f; every other character verbatim. */
export function nip01String(s) {
  let out = '"';
  for (const ch of s) {
    if (ch === "\n") out += "\\n";
    else if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else out += ch;
  }
  return out + '"';
}

/** NIP-01: [0,pubkey,created_at,kind,tags,content] as compact UTF-8 JSON. */
export function serialize(e) {
  const tags = "[" + e.tags.map((t) => "[" + t.map(nip01String).join(",") + "]").join(",") + "]";
  return `[0,${nip01String(e.pubkey)},${e.created_at},${e.kind},${tags},${nip01String(e.content)}]`;
}

export const eventId = (e) => bytesToHex(sha256(utf8ToBytes(serialize(e))));
export const sha256Hex = (s) => bytesToHex(sha256(utf8ToBytes(s)));

class AuthError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = (code) => {
  throw new AuthError(code);
};
const tagValues = (e, name) => e.tags.filter((t) => t[0] === name).map((t) => t[1]);

/**
 * Verify a NIP-98 login request. `consume(challengeId, nonceHash, bindingHash)` must atomically mark the challenge
 * used and return true only for the first caller; it runs last, after the signature is proven valid.
 */
export async function verifyLogin({ authorization, method, url, rawBody, now, binding, consume }) {
  if (typeof authorization !== "string" || !authorization.startsWith("Nostr ")) fail("missing_auth");
  const b64 = authorization.slice(6);
  if (b64.length > 8192) fail("too_large");
  let e;
  try {
    e = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    fail("bad_json");
  }
  // Shape (NIP-01 formats). Reject anything else before any crypto.
  if (!e || typeof e !== "object") fail("bad_shape");
  if (!HEX64.test(e.id ?? "") || !HEX64.test(e.pubkey ?? "") || !HEX128.test(e.sig ?? "")) fail("bad_shape");
  if (!Number.isSafeInteger(e.created_at) || !Number.isSafeInteger(e.kind)) fail("bad_shape");
  if (!Array.isArray(e.tags) || !e.tags.every((t) => Array.isArray(t) && t.length > 0 && t.every((v) => typeof v === "string"))) fail("bad_shape");
  if (typeof e.content !== "string") fail("bad_shape");
  // Protocol rules.
  if (e.kind !== 27235) fail("wrong_kind");
  if (e.content !== "") fail("content_not_empty");
  if (eventId(e) !== e.id) fail("bad_id");
  let ok = false;
  try {
    ok = schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey));
  } catch {
    ok = false;
  }
  if (!ok) fail("bad_sig");
  if (Math.abs(now - e.created_at) > 60) fail("stale");
  const u = tagValues(e, "u");
  if (u.length !== 1 || u[0] !== url) fail("wrong_url");
  const m = tagValues(e, "method");
  if (m.length !== 1 || m[0] !== method) fail("wrong_method");
  const p = tagValues(e, "payload");
  if (rawBody !== undefined && rawBody !== "") {
    if (p.length !== 1 || p[0] !== sha256Hex(rawBody)) fail("wrong_payload");
  } else if (p.length) fail("wrong_payload");
  // Challenge binding: body names the challenge; consumption is atomic and last.
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    fail("bad_body");
  }
  if (typeof body?.challengeId !== "string" || typeof body?.nonce !== "string") fail("bad_body");
  const used = await consume(body.challengeId, sha256Hex(body.nonce), sha256Hex(binding ?? ""));
  if (!used) fail("challenge_invalid");
  return { pubkey: e.pubkey };
}

/** Test helper: build a signed login event as a NIP-07/46 signer would. */
export function signLogin({ sk, url, method, rawBody, createdAt, kind = 27235, extraTags = [], content = "" }) {
  const pubkey = bytesToHex(schnorr.getPublicKey(sk));
  const tags = [["u", url], ["method", method], ...(rawBody ? [["payload", sha256Hex(rawBody)]] : []), ...extraTags];
  const ev = { pubkey, created_at: createdAt, kind, tags, content };
  ev.id = eventId(ev);
  ev.sig = bytesToHex(schnorr.sign(hexToBytes(ev.id), sk));
  return ev;
}
export const header = (ev) => "Nostr " + Buffer.from(JSON.stringify(ev)).toString("base64");
