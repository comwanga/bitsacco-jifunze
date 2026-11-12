// The built-in Jifunze signer: a Nostr key made for learning on this device only. Loaded on demand, when a
// learner saves progress, confirms a sensitive action, recovers or signs out; never in a page's initial script.
//
// The secret stays in IndexedDB. It is never sent anywhere, logged, shown, put in a URL, or written to
// localStorage or sessionStorage (which the progress export, storage events and every tab read). It is not
// encrypted at rest: automatic wrapping with a co-stored key would not prevent an active same-origin script
// from using it. See docs/audit/2026-11-12-learning-identity.md for the tradeoffs and residual risks.
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { IDENTITY_KEY } from "@/lib/progress/keys";
import type { ProofSigner } from "@/components/account/nostr-proof";

export type Identity = { pubkey: string; signer: ProofSigner };
const DB = "jifunze-identity", STORE = "keys", SLOT = "learning";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (blocked) request.transaction?.abort(); else request.result.createObjectStore(STORE); };
    request.onsuccess = () => { if (blocked) { request.result.close(); return; } request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(new Error("storage"));
    request.onblocked = () => { blocked = true; reject(new Error("storage")); };
  });
}
async function run<T>(mode: IDBTransactionMode, requestFor: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode), request = requestFor(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error("storage"));
    });
  } finally { db.close(); }
}
/** A public marker so small pages can word their buttons without loading this module. Never the secret. */
function mark(pubkey: string | null) {
  try { if (pubkey) localStorage.setItem(IDENTITY_KEY, pubkey); else localStorage.removeItem(IDENTITY_KEY); } catch { /* optional */ }
}
function identity(secret: Uint8Array): Identity {
  let pubkey: string;
  try { pubkey = getPublicKey(secret); } finally { secret.fill(0); }
  return { pubkey, signer: { signEvent: async (template) => {
    // This signer exists only for Jifunze authentication, never general Nostr publishing.
    const [url, method, payload] = template.tags;
    if (template.kind !== 27235 || template.content !== "" || template.tags.length !== 3
      || url?.length !== 2 || url[0] !== "u" || !["verify", "reauth", "replace"].some((p) => url[1] === location.origin + `/api/auth/nostr/${p}`)
      || method?.length !== 2 || method[0] !== "method" || method[1] !== "POST"
      || payload?.length !== 2 || payload[0] !== "payload" || !/^[0-9a-f]{64}$/.test(payload[1])) throw new Error("proof");
    // Read again at signing time: forgetting or changing the device identity invalidates old handles.
    const current = await run<unknown>("readonly", (store) => store.get(SLOT));
    if (!(current instanceof Uint8Array) || current.length !== 32) throw new Error("storage");
    try {
      if (getPublicKey(current) !== pubkey) throw new Error("identity changed");
      return finalizeEvent(template, current);
    } finally { current.fill(0); }
  } } };
}

/** The learning identity kept on this device, or null. Rejects when the browser cannot use its storage. */
export async function deviceIdentity(): Promise<Identity | null> {
  const stored = await run<unknown>("readonly", (store) => store.get(SLOT));
  if (stored !== undefined && (!(stored instanceof Uint8Array) || stored.length !== 32)) throw new Error("storage");
  const found = stored instanceof Uint8Array ? identity(stored) : null;
  mark(found ? found.pubkey : null);
  return found;
}

/** The existing identity, or a new one that is stored before it is ever used to open an account. */
export async function ensureIdentity(): Promise<Identity> {
  const existing = await deviceIdentity();
  if (existing) return existing;
  // add(), not put(): if another tab created one in the meantime this fails and both tabs use that one.
  const secret = generateSecretKey();
  try {
    await run("readwrite", (store) => store.add(secret, SLOT)).catch((err) => {
      if (!(err instanceof DOMException) || err.name !== "ConstraintError") throw err;
    });
  } finally { secret.fill(0); }
  const created = await deviceIdentity();
  if (!created) throw new Error("storage");
  // Ask the browser not to evict this origin's data under storage pressure. It may decline; recovery codes remain.
  void navigator.storage?.persist?.().catch(() => {});
  return created;
}

/** Removes the identity from this device. The account can then be opened only with a recovery code. */
export async function forgetIdentity(expectedPubkey: string): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"), store = tx.objectStore(STORE);
      const request = store.get(SLOT);
      request.onsuccess = () => {
        const stored: unknown = request.result;
        if (stored === undefined) return;
        try {
          if (!(stored instanceof Uint8Array) || getPublicKey(stored) !== expectedPubkey) { tx.abort(); return; }
          store.delete(SLOT);
        } catch { tx.abort(); }
        finally { if (stored instanceof Uint8Array) stored.fill(0); }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error("storage"));
    });
    mark(null);
  } finally { db.close(); }
}
