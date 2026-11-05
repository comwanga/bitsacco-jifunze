import { signedEvent } from "../api/test/nostr-helper";

// Synthetic identities, shared by the spec and the API environment in playwright.allowlist.config.ts.
const key = (fill: number) => new Uint8Array(32).fill(fill);
export const pubkeyOf = (k: Uint8Array) => signedEvent(new Uint8Array(), "", undefined, {}, [], k as typeof TESTERS.sw.nostrKey).pubkey;

export const TESTERS = {
  sw: { github: { id: 9_100_001, login: "tester-sw" }, nostrKey: key(11) },
  en: { github: { id: 9_100_002, login: "tester-en" }, nostrKey: key(12) },
};
