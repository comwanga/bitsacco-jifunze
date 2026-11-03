// Spike runner: BIP-340 vectors, real relay events (NIP-01), NIP-98 positive/negative cases, atomic consumption.
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";
import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { eventId, header, sha256Hex, signLogin, verifyLogin } from "./verify.mjs";

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

// 1. BIP-340 official vectors.
{
  const rows = fs.readFileSync("vectors/bip340.csv", "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
  let agree = 0;
  for (const [i, , pk, , msg, sig, expected] of rows) {
    let got = false;
    try { got = schnorr.verify(hexToBytes(sig.toLowerCase()), hexToBytes(msg.toLowerCase()), hexToBytes(pk.toLowerCase())); } catch { got = false; }
    if (got === (expected === "TRUE")) agree++;
    else console.log("  BIP-340 mismatch at vector", i);
  }
  check(`BIP-340 vectors: verify() agrees with expected result`, agree === rows.length, `${agree}/${rows.length}`);
}

// 2. Real events from public relays: NIP-01 id recomputation + signature.
async function fetchEvents(relay, n) {
  return new Promise((resolve) => {
    const out = [];
    const ws = new WebSocket(relay);
    const done = () => { try { ws.close(); } catch {} resolve(out); };
    const timer = setTimeout(done, 12000);
    ws.onopen = () => ws.send(JSON.stringify(["REQ", "spike", { kinds: [0, 1, 3, 7], limit: n }]));
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg[0] === "EVENT") out.push(msg[2]);
      if (msg[0] === "EOSE") { clearTimeout(timer); done(); }
    };
    ws.onerror = () => { clearTimeout(timer); done(); };
  });
}
{
  const events = [...(await fetchEvents("wss://relay.damus.io", 100)), ...(await fetchEvents("wss://nos.lol", 100))];
  let idOk = 0, sigOk = 0, stringifyDiffers = 0, special = 0;
  for (const e of events) {
    if (eventId(e) === e.id) idOk++;
    try { if (schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey))) sigOk++; } catch {}
    const naive = crypto.createHash("sha256").update(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content])).digest("hex");
    if (naive !== e.id) stringifyDiffers++;
    if (/[\n"\\\r\t\b\f]/.test(e.content)) special++;
  }
  check(`Relay events: NIP-01 id recomputed`, events.length > 0 && idOk === events.length, `${idOk}/${events.length} (content with escaped chars: ${special})`);
  check(`Relay events: signatures valid`, events.length > 0 && sigOk === events.length, `${sigOk}/${events.length}`);
  console.log(`  note: JSON.stringify-based ids differed on ${stringifyDiffers}/${events.length} events`);
}
// Serializer edge case NIP-01 defines: control chars other than the seven listed stay verbatim.
{
  const e = { pubkey: "a".repeat(64), created_at: 1, kind: 1, tags: [], content: "x\u0001y z\n" };
  const viaStringify = crypto.createHash("sha256").update(JSON.stringify([0, e.pubkey, 1, 1, [], e.content])).digest("hex");
  check("Serializer keeps U+0001 verbatim (JSON.stringify would escape it)", eventId(e) !== viaStringify);
}

// 3. NIP-98 login with a real Postgres challenge table.
const sql = postgres("postgres://postgres:spike-only@127.0.0.1:55432/spike", { max: 10, onnotice: () => {} });
await sql`drop table if exists auth_challenges`;
await sql`create table auth_challenges (id uuid primary key, secret_hash text not null, binding_hash text not null,
  expires_at timestamptz not null, used_at timestamptz)`;
const consume = async (id, nonceHash, bindingHash) => {
  if (!/^[0-9a-f-]{36}$/.test(id)) return false;
  const rows = await sql`update auth_challenges set used_at = now()
    where id = ${id} and secret_hash = ${nonceHash} and binding_hash = ${bindingHash}
      and used_at is null and expires_at > now() returning id`;
  return rows.length === 1;
};
async function newChallenge({ expiresIn = 300, binding = "cookie-A" } = {}) {
  const id = crypto.randomUUID(), nonce = crypto.randomBytes(32).toString("hex");
  await sql`insert into auth_challenges values (${id}, ${sha256Hex(nonce)}, ${sha256Hex(binding)}, now() + ${expiresIn + " seconds"}::interval, null)`;
  return { id, nonce, binding };
}
const URL_ = "https://jifunze.bitsacco.com/api/auth/nostr/verify";
const sk = schnorr.utils.randomSecretKey();
const now = Math.floor(Date.now() / 1000);
async function attempt(opts = {}) {
  const c = opts.challenge ?? (await newChallenge(opts.challengeOpts));
  const rawBody = opts.rawBody ?? JSON.stringify({ challengeId: c.id, nonce: c.nonce });
  const ev = opts.event ?? signLogin({ sk, url: opts.signUrl ?? URL_, method: opts.signMethod ?? "POST", rawBody: opts.signBody ?? rawBody, createdAt: opts.createdAt ?? now, kind: opts.kind, content: opts.content, extraTags: opts.extraTags });
  if (opts.mutate) opts.mutate(ev);
  try {
    const r = await verifyLogin({ authorization: opts.authorization ?? header(ev), method: "POST", url: URL_, rawBody, now, binding: opts.binding ?? c.binding, consume });
    return { ok: true, ...r, c, ev, rawBody };
  } catch (err) {
    return { ok: false, code: err.code ?? String(err), c, ev, rawBody };
  }
}
const expectCode = async (name, opts, code) => {
  const r = await attempt(opts);
  check(`NIP-98 rejects ${name}`, !r.ok && r.code === code, r.ok ? "accepted!" : r.code);
};

const good = await attempt();
check("NIP-98 accepts a correct login", good.ok && good.pubkey.length === 64, good.ok ? "ok" : good.code);
// Replay of the exact same request.
{
  let r;
  try { await verifyLogin({ authorization: header(good.ev), method: "POST", url: URL_, rawBody: good.rawBody, now, binding: good.c.binding, consume }); r = "accepted"; } catch (e) { r = e.code; }
  check("NIP-98 rejects a replay of a used challenge", r === "challenge_invalid", r);
}
await expectCode("wrong kind (22242)", { kind: 22242 }, "wrong_kind");
await expectCode("non-empty content", { content: "hi" }, "content_not_empty");
await expectCode("a tampered created_at (id mismatch)", { mutate: (e) => { e.created_at += 1; } }, "bad_id");
await expectCode("a forged signature", { mutate: (e) => { e.sig = (e.sig[0] === "a" ? "b" : "a") + e.sig.slice(1); } }, "bad_sig");
await expectCode("another key's signature", { mutate: (e) => { const o = signLogin({ sk: schnorr.utils.randomSecretKey(), url: URL_, method: "POST", rawBody: "x", createdAt: now }); e.sig = o.sig; } }, "bad_sig");
await expectCode("an event 61s old", { createdAt: now - 61 }, "stale");
await expectCode("an event 61s in the future", { createdAt: now + 61 }, "stale");
await expectCode("a URL for another site", { signUrl: "https://evil.example/api/auth/nostr/verify" }, "wrong_url");
await expectCode("a URL with an extra query", { signUrl: URL_ + "?x=1" }, "wrong_url");
await expectCode("two u tags", { extraTags: [["u", URL_]] }, "wrong_url");
await expectCode("method GET", { signMethod: "GET" }, "wrong_method");
await expectCode("a payload hash for a different body", { signBody: JSON.stringify({ challengeId: "x", nonce: "y" }) }, "wrong_payload");
await expectCode("an unknown challenge", { rawBody: JSON.stringify({ challengeId: crypto.randomUUID(), nonce: "00" }) }, "challenge_invalid");
await expectCode("an expired challenge", { challengeOpts: { expiresIn: -5 } }, "challenge_invalid");
await expectCode("a challenge bound to another browser", { binding: "cookie-B" }, "challenge_invalid");
await expectCode("a wrong nonce", { mutate: () => {}, rawBody: undefined, challenge: { ...(await newChallenge()), nonce: "ff" } }, "challenge_invalid");
await expectCode("a malformed header", { authorization: "Nostr not-base64!!" }, "bad_json");
await expectCode("a missing header", { authorization: "Bearer x" }, "missing_auth");
await expectCode("uppercase hex id", { mutate: (e) => { e.id = e.id.toUpperCase(); } }, "bad_shape");
// Concurrency: 20 simultaneous verifications of one valid request; exactly one may win.
{
  const c = await newChallenge();
  const rawBody = JSON.stringify({ challengeId: c.id, nonce: c.nonce });
  const ev = signLogin({ sk, url: URL_, method: "POST", rawBody, createdAt: now });
  const outcomes = await Promise.all(Array.from({ length: 20 }, () =>
    verifyLogin({ authorization: header(ev), method: "POST", url: URL_, rawBody, now, binding: c.binding, consume }).then(() => "ok", (e) => e.code)));
  const wins = outcomes.filter((o) => o === "ok").length;
  check("Atomic consumption: 20 concurrent requests, exactly 1 accepted", wins === 1, `${wins} accepted, ${outcomes.filter((o) => o === "challenge_invalid").length} rejected`);
}
await sql.end();

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync("results.json", JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
