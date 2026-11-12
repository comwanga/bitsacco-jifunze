// Keeps a signed-in learner's device copy and account copy of progress in step.
//
// Loaded on demand only (useProgress imports it dynamically, and only when a sign-in marker exists), so anonymous
// learners never download or run this file and it adds nothing to a lesson page's first load.
//
// The device copy stays the one the site reads. A sync posts it to the account and merges the answer back; both
// directions use the merge that only ever adds, so order, repeats and concurrent tabs cannot lose work.
// Nothing here touches a key, a token or a relay: the session is the HttpOnly cookie the browser sends itself.
import { exportFilename, mergeProgress, parseProgressFile, serializeProgress, type LessonProgress, type Progress } from "./model.ts";
import { ACCOUNT_KEY, DIRTY_KEY } from "./keys.ts";
import { getStorage, loadProgress, saveProgress, STORAGE_KEY } from "./storage.ts";

/** Whose progress the device copy is: an account id, or absent for progress made without an account. */
export const OWNER_KEY = "jifunze:progress:owner:v1";
/** When this browser last tried to sync (milliseconds), to keep page loads from asking again and again. */
export const ATTEMPT_KEY = "jifunze:sync:at:v1";

const DEBOUNCE_MS = 2_000;
const RETRY_MS = 15_000;
const STALE_MS = 5 * 60_000;
const CANONICAL = /^2\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const LESSON_KEY = /^(savers|builders|lightning)\/[a-z0-9-]{1,80}$/;

/**
 * mine: the device copy belongs to this account (or is empty and can simply become its copy).
 * unclaimed: it was made without an account; it joins the account only if the learner says so.
 * other: it belongs to a different account and is never merged.
 */
export type Ownership = "mine" | "unclaimed" | "other";
export type SyncResult = "synced" | "busy" | "offline" | "signed-out" | "unclaimed" | "other" | "error";

function get(key: string): string | null {
  try { return getStorage()?.getItem(key) ?? null; } catch { return null; }
}
function set(key: string, value: string): void {
  try { getStorage()?.setItem(key, value); } catch { /* storage unavailable: nothing to remember */ }
}
function remove(key: string): void {
  try { getStorage()?.removeItem(key); } catch { /* same */ }
}
/** Tells the progress hook in this tab that the stored copy changed (other tabs get the real storage event). */
function announce(): void {
  try { window.dispatchEvent(Object.assign(new Event("storage"), { key: STORAGE_KEY })); } catch { /* not a browser */ }
}

const hasProgress = (p: Progress) =>
  Object.values(p.lessons).some((l) => l.completedAt || l.reflectedAt || l.quiz || (l.lab?.passed.length ?? 0) > 0);

/** The same instant in the form the account API requires, or null when the text is not a usable time. */
function canonical(ts: string | undefined): string | null {
  if (!ts) return null;
  if (CANONICAL.test(ts)) return ts;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  const iso = new Date(t).toISOString();
  return CANONICAL.test(iso) ? iso : null;
}

/**
 * Rewrites every timestamp that can be read (an imported file may carry an offset or no milliseconds) as the same
 * instant in UTC with milliseconds. Text and time order then agree on the device and in the account. A timestamp
 * that cannot be read is left exactly as it is: nothing is invented and nothing is dropped from the device.
 */
export function canonicalise(p: Progress): Progress {
  const lessons: Record<string, LessonProgress> = {};
  for (const [key, l] of Object.entries(p.lessons)) {
    const next: LessonProgress = { ...l };
    if (l.completedAt) next.completedAt = canonical(l.completedAt) ?? l.completedAt;
    if (l.reflectedAt) next.reflectedAt = canonical(l.reflectedAt) ?? l.reflectedAt;
    if (l.quiz) next.quiz = { ...l.quiz, at: canonical(l.quiz.at) ?? l.quiz.at };
    lessons[key] = next;
  }
  return { ...p, lessons };
}

/**
 * The part of the device copy the account will accept. Anything it would refuse (an unreadable or, by the
 * server's clock, future time; an oversized value) is left out of the request and stays safely on the device.
 */
export function uploadable(p: Progress, notAfter = Infinity): Progress {
  const usable = (ts: string | undefined): string | undefined => {
    const c = canonical(ts);
    return c && Date.parse(c) <= notAfter ? c : undefined;
  };
  const lessons: Record<string, LessonProgress> = {};
  for (const key of Object.keys(p.lessons).filter((k) => LESSON_KEY.test(k)).sort().slice(0, 500)) {
    const l = p.lessons[key]!;
    const out: LessonProgress = {};
    const completedAt = usable(l.completedAt), reflectedAt = usable(l.reflectedAt), at = usable(l.quiz?.at);
    if (completedAt) out.completedAt = completedAt;
    if (reflectedAt) out.reflectedAt = reflectedAt;
    if (l.quiz && at && Number.isInteger(l.quiz.correct) && Number.isInteger(l.quiz.total)
      && l.quiz.correct >= 0 && l.quiz.correct <= l.quiz.total && l.quiz.total <= 1000) out.quiz = { correct: l.quiz.correct, total: l.quiz.total, at };
    const passed = [...new Set(l.lab?.passed ?? [])].filter((id) => id.length <= 64 && !id.includes("\u0000")).slice(0, 100);
    if (passed.length > 0) out.lab = { passed };
    if (Object.keys(out).length > 0) lessons[key] = out;
  }
  return { app: p.app, version: p.version, lessons };
}

export function ownership(accountId: string): Ownership {
  const owner = get(OWNER_KEY);
  if (owner === accountId) return "mine";
  // An empty device copy holds nothing to protect or to ask about, whoever used the device before.
  if (!deviceHasProgress()) return "mine";
  return owner ? "other" : "unclaimed";
}

/** True when this device holds any completion, discussion confirmation, quiz result or lab pass. */
export const deviceHasProgress = (): boolean => hasProgress(loadProgress(getStorage()));

/** True while something written on this device has not been confirmed by the account. */
export const unsent = (): boolean => get(DIRTY_KEY) === "1";

/** The account page calls this once the API has confirmed who is signed in. */
export function signedIn(accountId: string): void {
  set(ACCOUNT_KEY, accountId);
}

/** Sign-out or an expired session: stop syncing. The device copy and its owner are left exactly as they are. */
export function signedOut(): void {
  remove(ACCOUNT_KEY);
  stop();
}

/** The learner's explicit yes: progress made on this device without an account joins this account. */
export function claim(accountId: string): Promise<SyncResult> {
  if (!get(OWNER_KEY)) set(OWNER_KEY, accountId);
  return syncNow();
}

/**
 * The learner's explicit choice on a device that holds another account's copy: discard that copy here and show
 * this account's progress instead. The other account's own saved progress is not touched.
 */
export function replaceWithAccount(accountId: string): Promise<SyncResult> {
  remove(STORAGE_KEY);
  remove(DIRTY_KEY);
  set(OWNER_KEY, accountId);
  announce();
  return syncNow();
}

/** After a confirmed sign-out where the learner chose to leave nothing behind and everything was saved. */
export function forgetDevice(): void {
  for (const key of [STORAGE_KEY, OWNER_KEY, DIRTY_KEY, ATTEMPT_KEY]) remove(key);
  announce();
}

/** The device copy as an export file: its text and file name. */
export function exportDevice(now: string): { text: string; name: string } {
  return { text: serializeProgress(loadProgress(getStorage()), now), name: exportFilename(now) };
}

type Reply = { status: number; json: unknown; serverNow: number | null };
async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<Reply | null> {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? { "X-Jifunze": "1" } : { "X-Jifunze": "1", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      keepalive: method === "POST", // may finish while the page is being left
    });
    let json: unknown;
    try { json = await res.json(); } catch { json = undefined; }
    const date = Date.parse(res.headers.get("date") ?? "");
    return { status: res.status, json, serverNow: Number.isNaN(date) ? null : date };
  } catch {
    return null; // could not reach the service
  }
}

let inFlight: Promise<SyncResult> | null = null;

/** One sync. Calls made while one is running share its result instead of starting another. */
export function syncNow(): Promise<SyncResult> {
  inFlight ??= once().finally(() => { inFlight = null; });
  return inFlight;
}

async function once(): Promise<SyncResult> {
  let account = get(ACCOUNT_KEY);
  if (!account) return "signed-out";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  set(ATTEMPT_KEY, String(Date.now()));

  if (account === "?") {
    // Set at sign-in, before the account is known: ask once who this session is.
    const me = await call("GET", "/api/me");
    if (!me) return "offline";
    if (me.status === 401) { signedOut(); return "signed-out"; }
    const id = (me.json as { account?: { id?: unknown }; scope?: unknown } | undefined)?.account?.id;
    if (me.status !== 200 || typeof id !== "string" || (me.json as { scope?: unknown }).scope !== "full") return "error";
    if (get(ACCOUNT_KEY) !== "?") return "busy"; // another tab settled it meanwhile
    set(ACCOUNT_KEY, id);
    account = id;
  }

  const owns = ownership(account);
  if (owns !== "mine") return owns; // never merged without the learner's explicit choice
  set(OWNER_KEY, account); // an empty device copy simply becomes this account's copy

  const run = (): Promise<SyncResult> => exchange(account);
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  // One tab at a time. A tab that finds another already syncing leaves it to that one.
  if (locks) return locks.request("jifunze-progress-sync", { ifAvailable: true }, (lock) => (lock ? run() : "busy" as const));
  return run();
}

async function exchange(account: string): Promise<SyncResult> {
  const wasUnsent = unsent();
  remove(DIRTY_KEY); // a write during the request sets it again, so that work is sent next time
  const fail = (result: SyncResult): SyncResult => { if (wasUnsent) set(DIRTY_KEY, "1"); return result; };

  const local = loadProgress(getStorage());
  let reply = await call("POST", "/api/me/progress", uploadable(local));
  if (reply?.status === 400 && reply.serverNow !== null) {
    // Most likely this device's clock is ahead. Hold back what is still in the future by the server's clock;
    // it stays on the device and goes up once that time has passed. Nothing is re-dated.
    reply = await call("POST", "/api/me/progress", uploadable(local, reply.serverNow));
  }
  if (!reply) return fail("offline");
  if (reply.status === 401) { signedOut(); return fail("signed-out"); }
  if (reply.status !== 200) return fail("error");
  const parsed = parseProgressFile(JSON.stringify(reply.json));
  if (!parsed.ok) return fail("error");

  // The answer is this account's progress. Use it only if this device still belongs to this account.
  if (get(ACCOUNT_KEY) !== account || get(OWNER_KEY) !== account) return fail("busy");
  const storage = getStorage();
  // Merge into what is stored now, not what was sent: anything written during the request is kept.
  saveProgress(mergeProgress(canonicalise(loadProgress(storage)), parsed.progress), storage);
  announce();
  if (unsent()) schedule(DEBOUNCE_MS);
  return "synced";
}

let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function schedule(delay: number): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}
/** A page load or a return to the tab: sync if there is unsent work, or if the last look was a while ago. */
function maybe(): void {
  if (!get(ACCOUNT_KEY)) return;
  const since = Date.now() - Number(get(ATTEMPT_KEY) ?? 0);
  if (since > (unsent() ? RETRY_MS : STALE_MS)) void syncNow();
}
const onOnline = (): void => { if (get(ACCOUNT_KEY)) void syncNow(); };
const onVisibility = (): void => {
  if (document.visibilityState === "visible") maybe();
  else if (unsent() && get(ACCOUNT_KEY)) { clearTimeout(timer); void syncNow(); } // leaving: send now, not in two seconds
};

/** Called by the progress hook: after a local write (`wrote`), or when a page first shows progress. */
export function requestSync(wrote: boolean): void {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
  }
  if (wrote) schedule(DEBOUNCE_MS); // several quick writes become one request
  else maybe();
}

/** Removes the timer and listeners. Runs when the learner is signed out; safe to call at any time. */
export function stop(): void {
  clearTimeout(timer);
  timer = undefined;
  if (listening && typeof window !== "undefined") {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
  }
  listening = false;
}
