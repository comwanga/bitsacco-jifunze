import { expect, type BrowserContext, type WebSocketRoute } from "@playwright/test";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { decrypt, encrypt, getConversationKey } from "nostr-tools/nip44";
import type { Event, EventTemplate } from "nostr-tools/core";

/** Real NIP-44 encryption and Schnorr signatures through Playwright's simulated WebSocket relay.
 * This exercises the pinned browser SDK, not interoperability with a signing application. */
export async function simulatedSigner(context: BrowserContext) {
  const transport = generateSecretKey(); let identity = generateSecretKey();
  const sockets = new Map<WebSocketRoute, Map<string, { authors?: string[]; "#p"?: string[] }>>();
  let mode: "approve" | "decline" | "bad-signature" | "wrong-identity" | "hold" | "unsafe-switch" | "switch" = "approve";
  const held: (() => void)[] = [], requests: string[] = [], closed: WebSocketRoute[] = [], urls: string[] = [], seen = new Set<string>(), dead = new Set<string>();
  function deliver(event: Event) {
    for (const [socket, filters] of sockets) for (const [id, f] of filters) {
      if (f.authors && !f.authors.includes(event.pubkey)) continue;
      if (f["#p"] && !event.tags.some((t) => t[0] === "p" && f["#p"]!.includes(t[1]))) continue;
      socket.send(JSON.stringify(["EVENT", id, event]));
    }
  }
  function response(client: string, id: string, result?: string, error?: string) {
    const conversation = getConversationKey(transport, client);
    const event = finalizeEvent({ kind: 24133, created_at: Math.floor(Date.now() / 1000), tags: [["p", client]], content: encrypt(JSON.stringify({ id, ...(result === undefined ? {} : { result }), ...(error ? { error } : {}) }), conversation) }, transport);
    conversation.fill(0); deliver(event);
  }
  await context.routeWebSocket("wss://**", (socket) => {
    urls.push(socket.url());
    if (dead.has(new URL(socket.url()).host)) { void socket.close({ code: 1013, reason: "fixture unreachable" }); return; }
    sockets.set(socket, new Map());
    socket.onClose(() => { closed.push(socket); sockets.delete(socket); });
    socket.onMessage((raw) => {
      const m = JSON.parse(String(raw));
      if (m[0] === "REQ") { sockets.get(socket)?.set(m[1], m[2]); socket.send(JSON.stringify(["EOSE", m[1]])); return; }
      if (m[0] === "CLOSE") { sockets.get(socket)?.delete(m[1]); return; }
      if (m[0] !== "EVENT") return;
      const event = m[1] as Event;
      expect(verifyEvent(event)).toBe(true); expect(event.kind).toBe(24133);
      socket.send(JSON.stringify(["OK", event.id, true, ""]));
      if (seen.has(event.id)) return; // published to several relays: the signer acts once
      seen.add(event.id);
      const conversation = getConversationKey(transport, event.pubkey);
      const rpc = JSON.parse(decrypt(event.content, conversation)) as { id: string; method: string; params: string[] };
      conversation.fill(0); requests.push(rpc.method);
      if (rpc.method === "connect") { response(event.pubkey, rpc.id, "ack"); return; }
      if (rpc.method === "switch_relays") { response(event.pubkey, rpc.id, mode === "unsafe-switch" ? '["wss://127.0.0.1/"]' : mode === "switch" ? '["wss://relay.nsec.app/","wss://relay2.nsec.app/"]' : "null"); return; }
      if (rpc.method === "get_public_key") { response(event.pubkey, rpc.id, getPublicKey(identity)); return; }
      if (rpc.method === "sign_event") {
        const approve = () => {
          if (mode === "decline") { response(event.pubkey, rpc.id, undefined, "User rejected signing"); return; }
          const template = JSON.parse(rpc.params[0]) as EventTemplate;
          expect(template.kind).toBe(27235); expect(template.content).toBe("");
          const proof = finalizeEvent(template, mode === "wrong-identity" ? generateSecretKey() : identity);
          if (mode === "bad-signature") proof.sig = "0".repeat(128);
          response(event.pubkey, rpc.id, JSON.stringify({ ...proof, extra: "fixture-never-forward" }));
        };
        if (mode === "hold") held.push(approve); else approve();
      }
    });
  });
  return {
    requests, closed, sockets, urls,
    mode: (value: typeof mode) => { mode = value; },
    use: (key: Uint8Array) => { identity = key; },
    key: () => identity,
    /** Hosts whose relay closes every connection at once. */
    unreachable: (host: string) => { dead.add(host); },
    bunker: (relays = ["wss://relay.nsec.app/"]) => `bunker://${getPublicKey(transport)}?${relays.map((r) => `relay=${encodeURIComponent(r)}`).join("&")}&secret=fixture-one-use`,
    async pair(uri: string, wrongSecret = false, waitForSubscription = true) {
      const url = new URL(uri);
      if (waitForSubscription) await expect.poll(() => [...sockets.values()].some((f) => [...f.values()].some((x) => x["#p"]?.includes(url.hostname)))).toBe(true);
      response(url.hostname, "pairing", wrongSecret ? "wrong-secret" : url.searchParams.get("secret")!);
    },
    release() { for (const f of held.splice(0)) f(); },
    disconnect() { for (const socket of sockets.keys()) socket.close({ code: 1001, reason: "fixture disconnect" }); },
  };
}
