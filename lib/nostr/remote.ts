// Imported only after the learner chooses remote signing. No key or connection is shared between attempts.
import { BunkerSigner, createNostrConnectURI } from "nostr-tools/nip46";
import { decrypt, getConversationKey } from "nostr-tools/nip44";
import { generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { AbstractSimplePool, type SubscribeManyParams } from "nostr-tools/abstract-pool";
import type { Filter } from "nostr-tools/filter";
import { authenticationTemplate, bunkerAddress, relayList, relayURL } from "./remote-policy";
import type { ProofTemplate } from "@/components/account/nostr-proof";

export type RemoteFailure = "cancelled" | "timeout" | "disconnected" | "invalid" | "declined";
export class RemoteError extends Error { constructor(readonly reason: RemoteFailure) { super(reason); } }
// The curated pairing list. An attempt needs only one of them: see docs/audit/2026-11-12-nip46-acceptance.md
// for the live checks behind this choice. Third-party services; the owner confirms them before release.
export const PAIRING_RELAYS = ["wss://relay.nsec.app/", "wss://relay.primal.net/"];
const PERMISSIONS = ["get_public_key", "sign_event:27235"];

/** Pinned SDK close() closes only a subscription. Own all sockets, pending calls and key buffers as well. */
function forgetSigner(signer: BunkerSigner | undefined) {
  if (!signer) return;
  void signer.close().catch(() => {});
  // Compatibility assertion lives in remote.test.ts; these are ordinary private fields in 2.25.2.
  const state = signer as unknown as { conversationKey?: Uint8Array; cachedPubKey?: string; listeners: Record<string, { reject: (e: Error) => void }>; waitingForAuth: Record<string, boolean> };
  state.conversationKey?.fill(0);
  for (const listener of Object.values(state.listeners)) listener.reject(new RemoteError("cancelled"));
  state.listeners = {}; state.waitingForAuth = {}; state.cachedPubKey = undefined;
  if (signer.bp) { signer.bp.secret = null; signer.bp.relays = []; }
}

export function remoteAttempt(origin: string, address?: string) {
  // Validate pasted input before generating credentials or opening a socket.
  const bunker = address === undefined ? undefined : bunkerAddress(address);
  const key = generateSecretKey();
  const controller = new AbortController();
  const deadline = Date.now() + 120_000;
  let disposed = false, signer: BunkerSigner | undefined, identity: string | undefined, used = false, era = 0, live = 0;
  let allowed = new Set(relayList(bunker?.relays ?? PAIRING_RELAYS));
  let fail!: (e: RemoteError) => void;
  const failed = new Promise<never>((_, reject) => { fail = reject; });
  void failed.catch(() => {});
  const active = () => {
    if (disposed) throw new RemoteError("cancelled");
    if (Date.now() >= deadline) { close("timeout"); throw new RemoteError("timeout"); }
  };
  function close(reason: RemoteFailure = "cancelled") {
    if (disposed) return;
    disposed = true; uri = ""; clearTimeout(timer); controller.abort();
    forgetSigner(signer); signer = undefined;
    pool.destroy(); key.fill(0); identity = undefined;
    fail(new RemoteError(reason));
  }
  const timer = setTimeout(() => close("timeout"), 120_000);
  // Filter malformed frames before the SDK's diagnostic paths. Never log relay-supplied text or payloads.
  class QuietSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const normalized = relayURL(String(url));
      if (!allowed.has(normalized) || disposed) throw new RemoteError("invalid");
      super(normalized, protocols);
      // A socket retired by an approved relay switch belongs to an earlier era; its close is not a failure.
      // One unreachable relay among several is not a failure either: the attempt ends when none is left.
      const opened = era; let counted = true; live++;
      const lost = () => {
        if (!counted) return;
        counted = false;
        if (!disposed && opened === era && --live === 0) close("disconnected");
      };
      this.addEventListener("close", lost);
      this.addEventListener("message", (event) => {
        try {
          if (typeof event.data !== "string" || event.data.length > 100_000) throw new Error();
          const m = JSON.parse(event.data);
          // A relay that refuses the subscription or demands authentication is unusable for this attempt.
          if (Array.isArray(m) && (m[0] === "CLOSED" || m[0] === "AUTH")) { event.stopImmediatePropagation(); lost(); if (!disposed) this.close(); return; }
          if (!Array.isArray(m) || !["EVENT", "EOSE", "OK"].includes(m[0]) || typeof m[1] !== "string") throw new Error();
          if (m[0] === "EVENT") {
            const e = m[2];
            if (!e || e.kind !== 24133 || typeof e.content !== "string" || e.content.length > 90_000 || !Array.isArray(e.tags) || !verifyEvent(e)) throw new Error();
          }
        } catch { event.stopImmediatePropagation(); }
      });
    }
  }
  class PrivatePool extends AbstractSimplePool {
    override async ensureRelay(url: string, params?: { connectionTimeout?: number; abort?: AbortSignal }) {
      const normalized = relayURL(url);
      if (disposed || !allowed.has(normalized)) throw new RemoteError("invalid");
      const relay = await super.ensureRelay(normalized, { ...params, abort: controller.signal });
      relay.onnotice = () => {};
      if (disposed) { relay.close(); throw new RemoteError("cancelled"); }
      return relay;
    }
    override subscribe(relays: string[], filter: Filter, params: SubscribeManyParams) {
      return super.subscribe(relayList(relays), filter, { ...params, abort: controller.signal, onevent: (event) => {
        if (disposed) return;
        let conversation: Uint8Array | undefined;
        try {
          conversation = getConversationKey(key, event.pubkey);
          const response = JSON.parse(decrypt(event.content, conversation));
          if (!response || typeof response.id !== "string" || response.id.length > 200
            || (typeof response.result !== "string" && typeof response.error !== "string")) return;
          // Validated decrypted JSON only; avoid the dependency's malformed-handshake warning path.
          params.onevent?.(event);
        } catch { /* unauthenticated, malformed or unrelated response: ignore without logging */ }
        finally { conversation?.fill(0); }
      } });
    }
  }
  const pool = new PrivatePool({ verifyEvent, websocketImplementation: QuietSocket, maxWaitForConnection: 10_000, enablePing: false, enableReconnect: false,
    allowConnectingToRelay: (url) => !disposed && allowed.has(relayURL(url)) });
  let secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, "0")).join("");
  let uri = bunker ? "" : createNostrConnectURI({ clientPubkey: getPublicKey(key), relays: [...allowed], secret, perms: PERMISSIONS, name: "Bitsacco Jifunze", url: origin });
  secret = "";
  const params = { pool, skipSwitchRelays: true, onauth: () => close("invalid") };
  const race = async <T>(promise: Promise<T>): Promise<T> => { active(); const value = await Promise.race([promise, failed]); active(); return value; };
  const ready = (async () => {
    try {
      if (bunker) {
        signer = BunkerSigner.fromBunker(key, bunker, params);
        const ack = await race(signer.sendRequest("connect", [bunker.pubkey, bunker.secret ?? "", PERMISSIONS.join(","), JSON.stringify({ name: "Bitsacco Jifunze", url: origin })]));
        if (ack !== "ack") throw new RemoteError("invalid");
      } else {
        const pending = BunkerSigner.fromURI(key, uri, params, controller.signal);
        void pending.then((s) => { if (disposed) forgetSigner(s); }).catch(() => {});
        signer = await race(pending);
      }
      // New signers may choose different relays. Validate the entire answer before any connection.
      let switchTimer: ReturnType<typeof setTimeout> | undefined;
      const switched = await race(Promise.race([signer.sendRequest("switch_relays", []).catch(() => "null"),
        new Promise<string>((resolve) => { switchTimer = setTimeout(() => resolve("null"), 1500); })]));
      clearTimeout(switchTimer);
      let next: unknown;
      try { next = JSON.parse(switched); } catch { throw new RemoteError("invalid"); }
      if (next !== null) {
        const relays = relayList(next);
        if (JSON.stringify([...allowed].sort()) !== JSON.stringify([...relays].sort())) {
          const pointer = { ...signer.bp, relays };
          allowed = new Set(relays); era++; live = 0;
          forgetSigner(signer); pool.destroy();
          signer = BunkerSigner.fromBunker(key, pointer, params);
        }
      }
      identity = await race(signer.getPublicKey());
      if (!/^[0-9a-f]{64}$/.test(identity)) throw new RemoteError("invalid");
      uri = "";
      return identity;
    } catch (e) {
      // No relay accepted a request (AggregateError from publishing): a transport failure, not a bad signer.
      const reason = e instanceof RemoteError ? e.reason : e instanceof AggregateError ? "disconnected" : "invalid";
      close(reason); throw new RemoteError(reason);
    }
  })();
  void ready.catch(() => {});
  return {
    get uri() { return disposed ? "" : uri; },
    get signal() { return controller.signal; }, ready, failure: failed,
    async signEvent(template: ProofTemplate) {
      try {
        await ready; active();
        if (used || !authenticationTemplate(template, origin)) throw new RemoteError("invalid");
        used = true;
        const expected = JSON.stringify({ created_at: template.created_at, kind: template.kind, tags: template.tags, content: template.content });
        const event = await race(signer!.signEvent(template));
        if (event.pubkey !== identity || JSON.stringify({ created_at: event.created_at, kind: event.kind, tags: event.tags, content: event.content }) !== expected || !verifyEvent(event)) throw new RemoteError("invalid");
        return event;
      } catch (e) { throw e instanceof RemoteError ? e : new RemoteError("declined"); }
      finally { close(); }
    },
    close,
  };
}
