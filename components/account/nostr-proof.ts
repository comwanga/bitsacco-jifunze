import type { Lang } from "@/lib/i18n";
import { apiFetch, type ApiErrorCode, type ApiResult } from "./api";

export type ProofTemplate = { created_at: number; kind: number; tags: string[][]; content: string };
export type ProofSigner = { signEvent: (event: ProofTemplate) => Promise<unknown> };
export const hasSigner = (): boolean => typeof (window as Window & { nostr?: ProofSigner }).nostr?.signEvent === "function";
export type ProofError = ApiErrorCode | "no-signer" | "declined";
/** `signer` marks a failure inside the signer itself, which the sign-in page words differently from a lost connection. */
export type ProofResult<T> = ApiResult<T> | { ok: false; status: 0; code: ProofError; signer?: true };
type Options = { returnTo?: string; remote?: boolean; signal?: AbortSignal };
const invalid = { ok: false, status: 0, code: "nostr_invalid" } as const;

/** Acquire the challenge before pairing; make the NIP-98 timestamp only when ready to sign. */
export async function prepareProof<T>(purpose: "signin" | "reauth" | "replace", lang: Lang, expectedAccount?: string, opts: Options = {}): Promise<ProofResult<{ complete: (signer: ProofSigner, onSigning: () => void) => Promise<ProofResult<T>> }>> {
  const deadline = Date.now() + (opts.remote ? 120_000 : 300_000);
  const active = () => !opts.signal?.aborted && Date.now() < deadline;
  const path = `/api/auth/nostr/${purpose === "signin" ? "verify" : purpose}`;
  const challenge = await apiFetch<{ challengeId: string; nonce: string; url: string }>("/api/auth/nostr/challenge", {
    method: "POST", body: { purpose, lang, returnTo: opts.returnTo ?? `/${lang}/account/`, ...(opts.remote ? { remote: true } : {}) }, expectedAccount, signal: opts.signal,
  });
  if (!challenge.ok) return challenge;
  const ch = challenge.data;
  if (!active() || ch.url !== window.location.origin + path || typeof ch.challengeId !== "string" || typeof ch.nonce !== "string") return invalid;
  let used = false;
  return { ok: true, status: 200, data: { complete: async (signer, onSigning) => {
    if (used || !active()) return invalid;
    used = true;
    try {
      const rawBody = JSON.stringify({ challengeId: ch.challengeId, nonce: ch.nonce });
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody));
      const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
      const template = { created_at: Math.floor(Date.now() / 1000), kind: 27235, tags: [["u", ch.url], ["method", "POST"], ["payload", hash]], content: "" };
      const time = template.created_at, tags = JSON.stringify(template.tags);
      if (!active()) return invalid;
      onSigning();
      let event: unknown;
      try { event = await signer.signEvent(template); }
      catch (err) {
        const reason = err as { code?: unknown; message?: unknown };
        const declined = reason?.code === 4001 || (typeof reason?.message === "string" && /reject|denied|declin|cancel/i.test(reason.message));
        return declined ? { ok: false, status: 0, code: "declined" } : { ok: false, status: 0, code: "network", signer: true };
      }
      const s = event as { id?: unknown; pubkey?: unknown; sig?: unknown; created_at?: unknown; kind?: unknown; tags?: unknown; content?: unknown } | null;
      if (!active() || !s || s.created_at !== time || s.kind !== 27235 || s.content !== "" || JSON.stringify(s.tags) !== tags
        || typeof s.id !== "string" || !/^[0-9a-f]{64}$/.test(s.id)
        || typeof s.pubkey !== "string" || !/^[0-9a-f]{64}$/.test(s.pubkey)
        || typeof s.sig !== "string" || !/^[0-9a-f]{128}$/.test(s.sig)) return invalid;
      const publicProof = { id: s.id, pubkey: s.pubkey, sig: s.sig, created_at: s.created_at, kind: s.kind, tags: s.tags, content: s.content };
      const bytes = new TextEncoder().encode(JSON.stringify(publicProof));
      const authorization = "Nostr " + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
      return await apiFetch<T>(path, { method: "POST", rawBody, authorization, expectedAccount, signal: opts.signal });
    } catch { return { ok: false, status: 0, code: "network" }; }
  } } };
}

/** Browser and remote signing both submit only public proof fields to the existing verifier. */
export async function prove<T>(purpose: "signin" | "reauth" | "replace", lang: Lang, onSigning: () => void, expectedAccount?: string, opts: Options = {}): Promise<ProofResult<T>> {
  const signer = (window as Window & { nostr?: ProofSigner }).nostr;
  if (!hasSigner() || !signer) return { ok: false, status: 0, code: "no-signer" };
  const prepared = await prepareProof<T>(purpose, lang, expectedAccount, opts);
  return prepared.ok ? prepared.data.complete(signer, onSigning) : prepared;
}
