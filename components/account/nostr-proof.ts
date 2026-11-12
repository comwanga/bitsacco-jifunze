import type { Lang } from "@/lib/i18n";
import { apiFetch, type ApiErrorCode, type ApiResult } from "./api";

type Signer = { signEvent: (event: { created_at: number; kind: number; tags: string[][]; content: string }) => Promise<unknown> };
export const hasSigner = (): boolean => typeof (window as Window & { nostr?: Signer }).nostr?.signEvent === "function";
export type ProofError = ApiErrorCode | "no-signer" | "declined";
type Result<T> = ApiResult<T> | { ok: false; status: 0; code: ProofError };

/** A public, purpose-bound NIP-98 proof. Nothing returned by a signer is stored, and extra fields are discarded. */
export async function prove<T>(purpose: "reauth" | "replace", lang: Lang, onSigning: () => void, expectedAccount?: string): Promise<Result<T>> {
  const signer = (window as Window & { nostr?: Signer }).nostr;
  if (!hasSigner() || !signer) return { ok: false, status: 0, code: "no-signer" };
  try {
    const path = `/api/auth/nostr/${purpose}`;
    const challenge = await apiFetch<{ challengeId: string; nonce: string; url: string }>("/api/auth/nostr/challenge", {
      method: "POST", body: { purpose, lang, returnTo: `/${lang}/account/` }, expectedAccount,
    });
    if (!challenge.ok) return challenge;
    const ch = challenge.data;
    if (ch.url !== window.location.origin + path || typeof ch.challengeId !== "string" || typeof ch.nonce !== "string") {
      return { ok: false, status: 0, code: "nostr_invalid" };
    }
    const rawBody = JSON.stringify({ challengeId: ch.challengeId, nonce: ch.nonce });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody));
    const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
    const template = { created_at: Math.floor(Date.now() / 1000), kind: 27235, tags: [["u", ch.url], ["method", "POST"], ["payload", hash]], content: "" };
    // Snapshot before calling an extension: it can mutate the argument as well as return unexpected fields.
    const time = template.created_at, tags = JSON.stringify(template.tags);
    onSigning();
    let event: unknown;
    try { event = await signer.signEvent(template); }
    catch (err) {
      const reason = err as { code?: unknown; message?: unknown };
      const declined = reason?.code === 4001 || (typeof reason?.message === "string" && /reject|denied|declin|cancel/i.test(reason.message));
      return { ok: false, status: 0, code: declined ? "declined" : "network" };
    }
    const s = event as { id?: unknown; pubkey?: unknown; sig?: unknown; created_at?: unknown; kind?: unknown; tags?: unknown; content?: unknown } | null;
    if (!s || s.created_at !== time || s.kind !== 27235 || s.content !== "" || JSON.stringify(s.tags) !== tags
      || typeof s.id !== "string" || !/^[0-9a-f]{64}$/.test(s.id)
      || typeof s.pubkey !== "string" || !/^[0-9a-f]{64}$/.test(s.pubkey)
      || typeof s.sig !== "string" || !/^[0-9a-f]{128}$/.test(s.sig)) return { ok: false, status: 0, code: "nostr_invalid" };
    const publicProof = { id: s.id, pubkey: s.pubkey, sig: s.sig, created_at: s.created_at, kind: s.kind, tags: s.tags, content: s.content };
    const bytes = new TextEncoder().encode(JSON.stringify(publicProof));
    const authorization = "Nostr " + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
    return await apiFetch<T>(path, { method: "POST", rawBody, authorization, expectedAccount });
  } catch { return { ok: false, status: 0, code: "network" }; }
}
