import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { emptyProgress, mergeProgress, parseProgressFile, type LessonProgress, type Progress } from "../../lib/progress/model.ts";
import { ACCOUNT_KEY, DIRTY_KEY, STATUS_KEY } from "../../lib/progress/keys.ts";
import { STORAGE_KEY } from "../../lib/progress/storage.ts";

// The sync module against an in-memory account service that behaves like the real one (Stage 2): it merges with
// the same rules, refuses non-canonical and future timestamps, and answers 401 without a session.

type Lessons = Record<string, LessonProgress>;
const doc = (lessons: Lessons): Progress => ({ ...emptyProgress(), lessons });
const T = (day: number, ms = 0) => new Date(Date.UTC(2026, 9, day, 8, 0, 0, ms)).toISOString();
const canonical = (p: { lessons: Lessons }) =>
  JSON.stringify(Object.keys(p.lessons).sort().flatMap((k) => {
    const l = p.lessons[k]!;
    const row = [k, l.completedAt ?? null, l.reflectedAt ?? null, l.quiz ? [l.quiz.correct, l.quiz.total, l.quiz.at] : null, [...new Set(l.lab?.passed ?? [])].sort()];
    return l.completedAt || l.reflectedAt || l.quiz || (l.lab?.passed.length ?? 0) > 0 ? [row] : [];
  }));

class Device {
  private items = new Map<string, string>();
  getItem = (k: string) => this.items.get(k) ?? null;
  setItem = (k: string, v: string) => void this.items.set(k, String(v));
  removeItem = (k: string) => void this.items.delete(k);
  keys = () => [...this.items.keys()];
  progress = (): Progress => {
    const raw = this.items.get(STORAGE_KEY);
    const parsed = raw ? parseProgressFile(raw) : null;
    return parsed?.ok ? parsed.progress : emptyProgress();
  };
  /** What the progress hook does on a local write by a signed-in learner. */
  write(lessons: Lessons) {
    this.setItem(STORAGE_KEY, JSON.stringify(mergeProgress(this.progress(), doc(lessons))));
    if (this.getItem(ACCOUNT_KEY)) this.setItem(DIRTY_KEY, "1");
  }
}

const CANONICAL = /^2\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const server = {
  accounts: new Map<string, Progress>(),
  session: null as string | null, // the account the browser's cookie belongs to
  now: Date.UTC(2026, 10, 12, 12, 0, 0),
  calls: [] as { method: string; url: string; body: unknown; headers: Record<string, string>; keepalive: boolean }[],
  fail: null as null | "network" | number,
  delay: null as null | Promise<void>,
  posts: () => server.calls.filter((c) => c.method === "POST"),
};
async function fakeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? "GET";
  const body = init.body ? JSON.parse(init.body as string) as unknown : undefined;
  server.calls.push({ method, url, body, headers: init.headers as Record<string, string>, keepalive: init.keepalive === true });
  if (server.delay) await server.delay;
  if (server.fail === "network") throw new TypeError("failed to fetch");
  const reply = (status: number, json: unknown) => new Response(JSON.stringify(json), { status, headers: { date: new Date(server.now).toUTCString(), "content-type": "application/json" } });
  if (typeof server.fail === "number") return reply(server.fail, { error: { code: "internal" } });
  if (!server.session) return reply(401, { error: { code: "unauthenticated" } });
  const expected = (init.headers as Record<string, string>)["X-Jifunze-Account"];
  if (expected && expected !== server.session) return reply(409, { error: { code: "account_changed" } });
  if (url === "/api/me") return reply(200, { scope: "full", account: { id: server.session } });
  if (url !== "/api/me/progress") return reply(404, {});
  const stored = server.accounts.get(server.session) ?? emptyProgress();
  if (method === "GET") return reply(200, stored);
  const sent = body as Progress;
  if (Object.keys(sent).sort().join() !== "app,lessons,version") return reply(400, {});
  for (const l of Object.values(sent.lessons)) {
    for (const ts of [l.completedAt, l.reflectedAt, l.quiz?.at]) {
      if (ts !== undefined && (!CANONICAL.test(ts) || Date.parse(ts) > server.now + 5 * 60_000)) return reply(400, {});
    }
  }
  const merged = mergeProgress(stored, sent);
  server.accounts.set(server.session, merged);
  return reply(200, merged);
}

let device: Device;
let sync: typeof import("../../lib/progress/sync.ts");
const online = { value: true };
const use = (d: Device) => { device = d; vi.stubGlobal("window", windowFor(d)); };
const listeners = new Map<string, Set<() => void>>();
const target = { addEventListener: (t: string, f: () => void) => void (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f), removeEventListener: (t: string, f: () => void) => void listeners.get(t)?.delete(f) };
const windowFor = (d: Device) => ({ localStorage: d, dispatchEvent: () => true, ...target });
const fire = (type: string, event?: unknown) => { for (const f of listeners.get(type) ?? []) (f as (event?: unknown) => void)(event); };
const visibility = { state: "visible" };

beforeEach(async () => {
  vi.resetModules();
  listeners.clear();
  Object.assign(server, { session: null, fail: null, delay: null, now: Date.UTC(2026, 10, 12, 12, 0, 0) });
  server.accounts.clear();
  server.calls.length = 0;
  online.value = true;
  visibility.state = "visible";
  use(new Device());
  vi.stubGlobal("document", { get visibilityState() { return visibility.state; }, ...target });
  vi.stubGlobal("navigator", { get onLine() { return online.value; } });
  vi.stubGlobal("fetch", fakeFetch);
  sync = await import("../../lib/progress/sync.ts");
});
afterEach(() => {
  sync.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A device on which account `id` is signed in and owns the copy. */
function signedInAs(id: string, d = device) {
  server.session = id;
  d.setItem(ACCOUNT_KEY, id);
}

test("without a sign-in marker nothing is sent and nothing changes", async () => {
  device.write({ "savers/a": { completedAt: T(1) } });
  expect(await sync.syncNow()).toBe("signed-out");
  sync.requestSync(true);
  expect(server.calls).toEqual([]);
  expect(device.keys()).toEqual([STORAGE_KEY]);
});

test("a new device restores the account's saved progress", async () => {
  server.accounts.set("acct-a", doc({ "savers/a": { completedAt: T(1), reflectedAt: T(1), quiz: { correct: 3, total: 4, at: T(2) } }, "lightning/b": { lab: { passed: ["e1", "e2"] } } }));
  server.session = "acct-a";
  device.setItem(ACCOUNT_KEY, "?"); // what sign-in leaves before the account is known
  expect(await sync.syncNow()).toBe("synced");
  expect(device.getItem(ACCOUNT_KEY)).toBe("acct-a");
  expect(device.getItem(sync.OWNER_KEY)).toBe("acct-a");
  expect(canonical(device.progress())).toBe(canonical(server.accounts.get("acct-a")!));
  expect(server.calls.map((c) => `${c.method} ${c.url}`)).toEqual(["GET /api/me", "POST /api/me/progress"]);
});

test("progress made without an account joins the account only after the learner says yes", async () => {
  device.write({ "savers/a": { completedAt: T(3) } });
  server.accounts.set("acct-a", doc({ "savers/b": { completedAt: T(1) } }));
  signedInAs("acct-a");
  expect(sync.ownership("acct-a")).toBe("unclaimed");
  expect(await sync.syncNow()).toBe("unclaimed");
  expect(server.posts()).toEqual([]);
  expect(Object.keys(device.progress().lessons)).toEqual(["savers/a"]); // untouched
  expect(Object.keys(server.accounts.get("acct-a")!.lessons)).toEqual(["savers/b"]);
  expect(device.getItem(sync.OWNER_KEY)).toBeNull();

  expect(await sync.claim("acct-a")).toBe("synced");
  const want = canonical(doc({ "savers/a": { completedAt: T(3) }, "savers/b": { completedAt: T(1) } }));
  expect(canonical(device.progress())).toBe(want);
  expect(canonical(server.accounts.get("acct-a")!)).toBe(want);
  expect(sync.ownership("acct-a")).toBe("mine");
});

test("another account's copy on a shared device is never merged, in either direction", async () => {
  // Learner B used this device, kept a copy at sign-out, with one lesson never saved to B's account.
  signedInAs("acct-b");
  expect(await sync.syncNow()).toBe("synced");
  device.write({ "savers/b-only": { completedAt: T(2) } });
  sync.signedOut();
  expect(device.getItem(sync.OWNER_KEY)).toBe("acct-b");

  server.accounts.set("acct-a", doc({ "savers/a": { completedAt: T(1) } }));
  signedInAs("acct-a");
  expect(sync.ownership("acct-a")).toBe("other");
  expect(await sync.syncNow()).toBe("other");
  expect(await sync.claim("acct-a")).toBe("other"); // "add it" cannot take someone else's copy
  expect(server.posts().filter((c) => server.calls.indexOf(c) > 0 && c.body && Object.keys((c.body as Progress).lessons).includes("savers/b-only"))).toEqual([]);
  expect(Object.keys(server.accounts.get("acct-a")!.lessons)).toEqual(["savers/a"]);
  expect(Object.keys(device.progress().lessons)).toEqual(["savers/b-only"]);

  // Only the learner's explicit replacement changes the device, and it leaves B's account alone.
  const savedForB = canonical(server.accounts.get("acct-b") ?? emptyProgress());
  expect(await sync.replaceWithAccount("acct-a")).toBe("synced");
  expect(Object.keys(device.progress().lessons)).toEqual(["savers/a"]);
  expect(device.getItem(sync.OWNER_KEY)).toBe("acct-a");
  expect(canonical(server.accounts.get("acct-b") ?? emptyProgress())).toBe(savedForB);
  expect(Object.keys(server.accounts.get("acct-a")!.lessons)).toEqual(["savers/a"]);
});

test("offline work is kept, marked unsent, and sent when the connection returns", async () => {
  signedInAs("acct-a");
  await sync.syncNow();
  online.value = false;
  device.write({ "savers/a": { completedAt: T(1), lab: { passed: ["e1"] } } });
  expect(await sync.syncNow()).toBe("offline");
  expect(sync.unsent()).toBe(true);
  online.value = true;
  server.fail = "network"; // the browser thinks it is online but the request fails
  expect(await sync.syncNow()).toBe("offline");
  expect(sync.unsent()).toBe(true);
  expect(device.progress().lessons["savers/a"]).toEqual({ completedAt: T(1), lab: { passed: ["e1"] } });
  server.fail = null;
  sync.requestSync(false); // registers the listeners, as a page load does
  fire("online");
  await vi.waitFor(() => expect(server.accounts.get("acct-a")?.lessons["savers/a"]).toBeDefined());
  await sync.syncNow();
  expect(sync.unsent()).toBe(false);
});

test("an expired session stops the sync and keeps every piece of local progress", async () => {
  signedInAs("acct-a");
  await sync.syncNow();
  device.write({ "savers/a": { completedAt: T(1), quiz: { correct: 2, total: 2, at: T(1) } } });
  server.session = null; // the session expired or was ended elsewhere
  expect(await sync.syncNow()).toBe("signed-out");
  expect(device.getItem(ACCOUNT_KEY)).toBeNull();
  expect(device.getItem(sync.OWNER_KEY)).toBe("acct-a"); // still that learner's copy
  expect(sync.unsent()).toBe(true);
  expect(device.progress().lessons["savers/a"]).toEqual({ completedAt: T(1), quiz: { correct: 2, total: 2, at: T(1) } });
  const before = server.calls.length;
  expect(await sync.syncNow()).toBe("signed-out");
  expect(server.calls.length).toBe(before); // no further requests
  // Signing in again as the same learner sends the kept work.
  signedInAs("acct-a");
  expect(await sync.syncNow()).toBe("synced");
  expect(server.accounts.get("acct-a")!.lessons["savers/a"]).toBeDefined();
});

test.each([500, 502, 429])("a server error (%i) changes nothing and a later sync succeeds", async (status) => {
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  device.write({ "savers/a": { completedAt: T(1) } });
  server.fail = status;
  expect(await sync.syncNow()).toBe("error");
  expect(sync.unsent()).toBe(true);
  expect(device.progress().lessons["savers/a"]).toEqual({ completedAt: T(1) });
  expect(device.getItem(ACCOUNT_KEY)).toBe("acct-a");
  server.fail = null;
  expect(await sync.syncNow()).toBe("synced");
  expect(sync.unsent()).toBe(false);
  expect(server.accounts.get("acct-a")!.lessons["savers/a"]).toEqual({ completedAt: T(1) });
});

test("an answer that is not a progress document is ignored", async () => {
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  device.write({ "savers/a": { completedAt: T(1) } });
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ app: "other", lessons: { "savers/x": { completedAt: T(1) } } }), { status: 200 }));
  expect(await sync.syncNow()).toBe("error");
  expect(Object.keys(device.progress().lessons)).toEqual(["savers/a"]);
  expect(sync.unsent()).toBe(true);
});

test("work written while a sync is in flight is neither overwritten nor forgotten", async () => {
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  server.accounts.set("acct-a", doc({ "savers/remote": { completedAt: T(1) } }));
  device.write({ "savers/first": { completedAt: T(2) } });
  let release!: () => void;
  server.delay = new Promise<void>((r) => { release = r; });
  const running = sync.syncNow();
  const again = sync.syncNow(); // a second trigger shares the first request
  await Promise.resolve();
  device.write({ "savers/during": { completedAt: T(3), lab: { passed: ["e9"] } } }); // the learner keeps working
  release();
  expect(await running).toBe("pending");
  expect(await again).toBe("pending");
  expect(sync.canForgetDevice("acct-a")).toBe(false);
  expect(server.posts()).toHaveLength(1);
  expect(Object.keys(device.progress().lessons).sort()).toEqual(["savers/during", "savers/first", "savers/remote"]);
  expect(sync.unsent()).toBe(true); // the later write is still to be sent
  server.delay = null;
  expect(await sync.syncNow()).toBe("synced");
  expect(server.accounts.get("acct-a")!.lessons["savers/during"]).toEqual({ completedAt: T(3), lab: { passed: ["e9"] } });
  expect(sync.unsent()).toBe(false);
  expect(sync.canForgetDevice("acct-a")).toBe(true);
});

test("imported timestamps are sent as the same instant in canonical form; unreadable ones stay on the device", async () => {
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  device.setItem(STORAGE_KEY, JSON.stringify(doc({
    "savers/offset": { completedAt: "2026-10-01T10:00:00+03:00", quiz: { correct: 1, total: 2, at: "2026-10-01T07:30:00Z" } },
    "savers/unreadable": { completedAt: "yesterday", reflectedAt: T(1), lab: { passed: ["e1"] } },
    "savers/only-unreadable": { completedAt: "not a date" },
  })));
  expect(await sync.syncNow()).toBe("pending");
  expect(sync.unsent()).toBe(true);
  expect(sync.canForgetDevice("acct-a")).toBe(false);
  const sent = server.posts()[0]!.body as Progress;
  expect(sent.lessons["savers/offset"]).toEqual({ completedAt: "2026-10-01T07:00:00.000Z", quiz: { correct: 1, total: 2, at: "2026-10-01T07:30:00.000Z" } });
  expect(sent.lessons["savers/unreadable"]).toEqual({ reflectedAt: T(1), lab: { passed: ["e1"] } }); // no completion time is invented
  expect(sent.lessons["savers/only-unreadable"]).toBeUndefined();
  const local = device.progress().lessons;
  expect(local["savers/offset"]!.completedAt).toBe("2026-10-01T07:00:00.000Z"); // same instant, now canonical on the device too
  expect(Date.parse(local["savers/offset"]!.completedAt!)).toBe(Date.parse("2026-10-01T10:00:00+03:00"));
  expect(local["savers/unreadable"]!.completedAt).toBe("yesterday"); // kept exactly
  expect(local["savers/only-unreadable"]).toEqual({ completedAt: "not a date" });
  expect(sync.canonicalise(sync.canonicalise(device.progress()))).toEqual(sync.canonicalise(device.progress()));
});

test("a device whose clock is ahead keeps its work and sends what the server can accept", async () => {
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  const ahead = new Date(server.now + 3 * 3_600_000).toISOString(); // three hours in the server's future
  device.write({ "savers/past": { completedAt: T(1) }, "savers/ahead": { completedAt: ahead, reflectedAt: T(1) } });
  expect(await sync.syncNow()).toBe("pending");
  expect(sync.unsent()).toBe(true);
  expect(sync.canForgetDevice("acct-a")).toBe(false);
  expect(server.posts()).toHaveLength(2); // refused once, then sent without the future time
  const stored = server.accounts.get("acct-a")!.lessons;
  expect(stored["savers/past"]).toEqual({ completedAt: T(1) });
  expect(stored["savers/ahead"]).toEqual({ reflectedAt: T(1) });
  expect(device.progress().lessons["savers/ahead"]).toEqual({ completedAt: ahead, reflectedAt: T(1) }); // not re-dated, not lost
  server.now += 4 * 3_600_000; // once that time has really passed, it goes up unchanged
  expect(await sync.syncNow()).toBe("synced");
  expect(server.accounts.get("acct-a")!.lessons["savers/ahead"]).toEqual({ completedAt: ahead, reflectedAt: T(1) });
});

test("values the account would refuse stay on the device and do not block the rest", () => {
  const p = doc({
    ["savers/" + "a".repeat(81)]: { completedAt: T(1) },
    "savers/quiz": { quiz: { correct: 2000, total: 2000, at: T(1) }, completedAt: T(1) },
    "savers/lab": { lab: { passed: ["ok", "nul\u0000id", "ok"] } },
    "savers/empty": {},
  });
  expect(sync.uploadable(p).lessons).toEqual({ "savers/quiz": { completedAt: T(1) }, "savers/lab": { lab: { passed: ["ok"] } } });
  expect(Object.keys(sync.uploadable(p)).sort()).toEqual(["app", "lessons", "version"]);
});

test("progress bodies cannot select an account; a same-origin expectation guards the cookie's scope", async () => {
  server.session = "acct-secret-id";
  device.setItem(ACCOUNT_KEY, "?");
  device.write({ "savers/a": { completedAt: T(1) } });
  await sync.claim("acct-secret-id");
  await sync.syncNow();
  expect(server.posts().length).toBeGreaterThan(0);
  for (const c of server.calls) {
    expect(["/api/me", "/api/me/progress"]).toContain(c.url);
    expect(JSON.stringify(c.body ?? {})).not.toContain("acct-secret-id");
    expect(c.headers["X-Jifunze"]).toBe("1");
    expect(c.headers["X-Jifunze-Account"]).toBe(c.method === "POST" ? "acct-secret-id" : undefined);
    expect(Object.keys(c.headers).map((h) => h.toLowerCase())).not.toContain("authorization");
  }
  expect(server.posts().every((c) => c.keepalive)).toBe(true);
});

test("syncing again changes nothing, and devices converge whatever order they sync in", async () => {
  const phone = new Device(), laptop = new Device(), tablet = new Device();
  const work: [Device, Lessons][] = [
    [phone, { "savers/a": { completedAt: T(3), quiz: { correct: 1, total: 2, at: T(2) }, lab: { passed: ["e1"] } } }],
    [laptop, { "savers/a": { completedAt: T(2), reflectedAt: T(2), quiz: { correct: 2, total: 4, at: T(2) }, lab: { passed: ["e2"] } }, "builders/b": { completedAt: T(4) } }],
    [tablet, { "savers/a": { quiz: { correct: 3, total: 3, at: T(5) } }, "lightning/c": { lab: { passed: ["x"] } } }],
  ];
  const want = canonical(work.reduce((acc, [, l]) => mergeProgress(acc, doc(l)), emptyProgress()));
  for (const order of [[0, 1, 2], [2, 1, 0], [1, 2, 0], [0, 2, 1]]) {
    server.accounts.clear();
    for (const [d, lessons] of work) {
      for (const k of d.keys()) d.removeItem(k);
      d.setItem(ACCOUNT_KEY, "acct-a");
      d.setItem(sync.OWNER_KEY, "acct-a");
      d.write(lessons);
    }
    server.session = "acct-a";
    // Each device syncs once in this order, then each once more to pick up what the others sent.
    for (const i of [...order, ...order]) { use(work[i]![0]); expect(await sync.syncNow()).toBe("synced"); }
    for (const [d] of work) expect(canonical(d.progress())).toBe(want);
    expect(canonical(server.accounts.get("acct-a")!)).toBe(want);
    // Repeating changes nothing anywhere.
    for (const i of order) { use(work[i]![0]); await sync.syncNow(); }
    for (const [d] of work) expect(canonical(d.progress())).toBe(want);
    expect(canonical(server.accounts.get("acct-a")!)).toBe(want);
  }
});

test("quick writes become one request, and a page load does not ask again straight away", async () => {
  vi.useFakeTimers();
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  for (const n of [1, 2, 3]) { device.write({ [`savers/l${n}`]: { completedAt: T(n) } }); sync.requestSync(true); }
  expect(server.calls).toEqual([]);
  await vi.advanceTimersByTimeAsync(2_100);
  expect(server.posts()).toHaveLength(1);
  expect(Object.keys((server.posts()[0]!.body as Progress).lessons)).toHaveLength(3);
  // Nothing unsent and a recent sync: page loads and returning to the tab stay quiet.
  sync.requestSync(false);
  fire("visibilitychange");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(server.posts()).toHaveLength(1);
  // After five minutes a page load looks again, once.
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  sync.requestSync(false);
  await vi.advanceTimersByTimeAsync(10);
  expect(server.posts()).toHaveLength(2);
});

test("leaving the page sends unsent work at once; stop() removes the timer and listeners", async () => {
  vi.useFakeTimers();
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  device.write({ "savers/a": { completedAt: T(1) } });
  sync.requestSync(true);
  visibility.state = "hidden";
  fire("visibilitychange");
  await vi.advanceTimersByTimeAsync(10);
  expect(server.posts()).toHaveLength(1); // did not wait for the two-second timer
  expect([...listeners.values()].reduce((n, s) => n + s.size, 0)).toBe(4); // online, offline, visibility, cross-tab status
  device.write({ "savers/b": { completedAt: T(2) } });
  sync.requestSync(true);
  sync.stop();
  expect([...listeners.values()].reduce((n, s) => n + s.size, 0)).toBe(0);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(server.posts()).toHaveLength(1); // the pending timer was cancelled
});

test("signing out keeps the device copy; forgetting the device removes only sync and progress keys", async () => {
  signedInAs("acct-a");
  device.setItem("unrelated", "kept");
  device.write({ "savers/a": { completedAt: T(1) } });
  await sync.claim("acct-a");
  sync.signedOut();
  expect(device.getItem(ACCOUNT_KEY)).toBeNull();
  expect(Object.keys(device.progress().lessons)).toEqual(["savers/a"]);
  expect(device.getItem(sync.OWNER_KEY)).toBe("acct-a");
  sync.forgetDevice();
  expect(device.keys()).toEqual(["unrelated"]);
  expect(Object.keys(server.accounts.get("acct-a")!.lessons)).toEqual(["savers/a"]); // the account still has it
});

test("an empty device copy is never treated as someone else's, whoever signed in there before", async () => {
  device.setItem(sync.OWNER_KEY, "acct-b"); // B used this device and left nothing behind
  server.accounts.set("acct-a", doc({ "savers/a": { completedAt: T(1) } }));
  signedInAs("acct-a");
  expect(sync.deviceHasProgress()).toBe(false);
  expect(sync.ownership("acct-a")).toBe("mine");
  expect(await sync.syncNow()).toBe("synced");
  expect(device.getItem(sync.OWNER_KEY)).toBe("acct-a");
  expect(Object.keys(device.progress().lessons)).toEqual(["savers/a"]);
  expect(server.accounts.has("acct-b")).toBe(false);
});

test("persistence status distinguishes anonymous, consent, foreign, pending, confirmed, offline and expired without extra requests", async () => {
  expect(sync.persistenceStatus()).toBe("local");
  device.write({ "savers/a": { completedAt: T(1) } });
  signedInAs("acct-a");
  expect(sync.persistenceStatus()).toBe("unclaimed");
  device.setItem(sync.OWNER_KEY, "acct-b");
  expect(sync.persistenceStatus()).toBe("other");
  device.setItem(sync.OWNER_KEY, "acct-a");
  expect(sync.persistenceStatus()).toBe("pending");
  await sync.syncNow();
  expect(sync.persistenceStatus()).toBe("synced");
  device.write({ "savers/b": { completedAt: T(2) } });
  expect(sync.persistenceStatus()).toBe("pending");
  online.value = false;
  expect(sync.persistenceStatus()).toBe("offline");
  online.value = true;
  server.session = null;
  await sync.syncNow();
  expect(sync.persistenceStatus()).toBe("expired");
  const calls = server.calls.length;
  sync.showStatus(); sync.requestSync(false); fire("online");
  expect(server.calls).toHaveLength(calls);
  expect(device.getItem(STATUS_KEY)).toBe("expired");
});

test("another tab holding the sync lock is never described as a confirmed save", async () => {
  signedInAs("acct-a");
  vi.stubGlobal("navigator", { onLine: true, locks: { request: (_: unknown, _options: unknown, callback: (lock: null) => string) => callback(null) } });
  expect(await sync.syncNow()).toBe("busy");
  expect(sync.persistenceStatus()).toBe("pending");
  expect(sync.canForgetDevice("acct-a")).toBe(false);
  expect(server.calls).toEqual([]);
});

test("a write after the final sync prevents removal; deletion keeps and releases only the deleted account's copy", async () => {
  signedInAs("acct-a");
  await sync.syncNow();
  expect(sync.canForgetDevice("acct-a")).toBe(true);
  device.write({ "savers/new": { completedAt: T(1) } });
  expect(sync.canForgetDevice("acct-a")).toBe(false);
  sync.accountDeleted("acct-a", true);
  expect(device.progress().lessons["savers/new"]).toBeDefined();
  expect(device.getItem(sync.OWNER_KEY)).toBeNull();
  expect(device.getItem(ACCOUNT_KEY)).toBeNull();
  device.setItem(sync.OWNER_KEY, "acct-b");
  sync.accountDeleted("acct-a", true);
  expect(device.getItem(sync.OWNER_KEY)).toBe("acct-b");
  expect(device.progress().lessons["savers/new"]).toBeDefined();
});

test("withheld timestamps do not start an endless two-second retry loop", async () => {
  vi.useFakeTimers();
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  device.write({ "savers/a": { completedAt: "unreadable" } });
  expect(await sync.syncNow()).toBe("pending");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(server.posts()).toHaveLength(1);
  expect(sync.canForgetDevice("acct-a")).toBe(false);
});

test("storage availability probes cannot create a status feedback loop between tabs", () => {
  sync.showStatus();
  const changed = vi.fn();
  const unsubscribe = sync.subscribeStatus(changed);
  // Every status read invokes getStorage(), which writes/removes this probe in the real browser.
  for (let i = 0; i < 20; i++) fire("storage", { key: "jifunze:probe" });
  fire("storage", { key: "unrelated" });
  expect(changed).not.toHaveBeenCalled();
  for (const key of [ACCOUNT_KEY, sync.OWNER_KEY, DIRTY_KEY, STATUS_KEY, STORAGE_KEY, null]) fire("storage", { key });
  expect(changed).toHaveBeenCalledTimes(6);
  unsubscribe();
});

test("a stale account marker cannot upload one learner's progress into a newly active session", async () => {
  signedInAs("acct-a");
  device.setItem(sync.OWNER_KEY, "acct-a");
  device.write({ "savers/private-a": { completedAt: T(1) } });
  server.session = "acct-b"; // cookie changed, before the other tab could update the local sign-in marker
  expect(await sync.syncNow()).toBe("signed-out");
  expect(server.accounts.has("acct-b")).toBe(false);
  expect(device.progress().lessons["savers/private-a"]).toBeDefined();
  expect(sync.unsent()).toBe(true);
  expect(sync.persistenceStatus()).toBe("expired");
});
