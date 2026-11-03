import { isIP } from "node:net";

/** In-memory fixed-window limiter. A restart resets the counts. */
export type Rule = { name: string; key: (ip: string) => string; limit: number; windowMs: number };

const SWEEP_EVERY_MS = 60_000;
const SWEEP_THRESHOLD = 10_000;

export class Limiter {
  private readonly rules: Rule[];
  private readonly now: () => number;
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep: number;
  /** How many expiry sweeps have run (observable so tests can prove they are rare). */
  sweeps = 0;

  constructor(rules: Rule[], now: () => number = Date.now) {
    this.rules = rules;
    this.now = now;
    this.lastSweep = now();
  }

  get size(): number {
    return this.buckets.size;
  }

  /** Counts the request against every rule; false means at least one limit is exceeded. */
  hit(ip: string): boolean {
    const now = this.now();
    // Expired buckets are dropped at most once a minute, so a crowd of live buckets cannot make every request O(n).
    if (this.buckets.size > SWEEP_THRESHOLD && now - this.lastSweep >= SWEEP_EVERY_MS) {
      this.lastSweep = now;
      this.sweeps += 1;
      for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
    }
    // A refused request must not consume any rule's allowance, or one blocked client would drain shared (network) limits.
    const ids = this.rules.map((rule) => `${rule.name}|${rule.key(ip)}`);
    const live = ids.map((id) => {
      const b = this.buckets.get(id);
      return b && b.resetAt > now ? b : undefined;
    });
    for (const [i, rule] of this.rules.entries()) if ((live[i]?.count ?? 0) >= rule.limit) return false;
    for (const [i, rule] of this.rules.entries()) {
      let b = live[i];
      if (!b) {
        b = { count: 0, resetAt: now + rule.windowMs };
        this.buckets.set(ids[i]!, b);
      }
      b.count += 1;
    }
    return true;
  }
}

/** Parses an IP to 4 bytes (IPv4, including IPv4-mapped IPv6 in any spelling) or 16 bytes (IPv6); null if invalid. */
function ipBytes(input: string): number[] | null {
  const kind = isIP(input);
  if (kind === 0) return null;
  if (kind === 4) return input.split(".").map(Number);
  let text = input.toLowerCase();
  const pct = text.indexOf("%");
  if (pct >= 0) text = text.slice(0, pct);
  const last = text.lastIndexOf(":");
  const tail = text.slice(last + 1);
  if (tail.includes(".")) {
    const q = tail.split(".").map(Number);
    text = `${text.slice(0, last + 1)}${((q[0]! << 8) | q[1]!).toString(16)}:${((q[2]! << 8) | q[3]!).toString(16)}`;
  }
  const [head = "", rest] = text.split("::");
  const h = head === "" ? [] : head.split(":");
  const t = rest === undefined || rest === "" ? [] : rest.split(":");
  const groups = rest === undefined ? h : [...h, ...Array<string>(8 - h.length - t.length).fill("0"), ...t];
  const bytes = groups.flatMap((g) => {
    const n = parseInt(g, 16);
    return [n >> 8, n & 255];
  });
  const mapped = bytes.slice(0, 10).every((x) => x === 0) && bytes[10] === 255 && bytes[11] === 255;
  return mapped ? bytes.slice(12) : bytes;
}

const groupsOf = (bytes: number[], count: number): string =>
  Array.from({ length: count }, (_, i) => ((bytes[2 * i]! << 8) | bytes[2 * i + 1]!).toString(16)).join(":");

/** Lower-case; IPv4-mapped IPv6 in any spelling becomes plain IPv4. Invalid input is returned unchanged. */
export const normaliseIp = (ip: string): string => {
  const b = ipBytes(ip);
  if (!b) return ip;
  return b.length === 4 ? b.join(".") : ip.toLowerCase();
};

/** Per-client key: the IPv4 address; the /64 prefix for IPv6. Derived from parsed bytes, not text. */
export const perIp = (ip: string): string => {
  const b = ipBytes(ip);
  if (!b) return ip;
  return b.length === 4 ? b.join(".") : `${groupsOf(b, 4)}::/64`;
};

/** "203.0.113.0/24" for IPv4; the /48 ("2001:db8:1::/48") for IPv6; anything else unchanged. */
export const slash24 = (ip: string): string => {
  const b = ipBytes(ip);
  if (!b) return ip;
  return b.length === 4 ? `${b[0]}.${b[1]}.${b[2]}.0/24` : `${groupsOf(b, 3)}::/48`;
};
