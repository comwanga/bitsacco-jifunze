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
    let ok = true;
    for (const rule of this.rules) {
      const id = `${rule.name}|${rule.key(ip)}`;
      let b = this.buckets.get(id);
      if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + rule.windowMs };
        this.buckets.set(id, b);
      }
      b.count += 1;
      if (b.count > rule.limit) ok = false;
    }
    return ok;
  }
}

const unmap = (ip: string): string => (ip.startsWith("::ffff:") ? ip.slice(7) : ip);

/** The eight groups of an IPv6 address (lower-case, no leading zeros), or null if it is not IPv6. */
function ipv6Groups(a: string): string[] | null {
  if (isIP(a) !== 6) return null;
  const [head = "", tail] = a.split("::");
  const h = head === "" ? [] : head.split(":");
  const t = tail === undefined || tail === "" ? [] : tail.split(":");
  const groups = tail === undefined ? h : [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return groups.map((g) => (g || "0").toLowerCase().replace(/^0+(?=.)/, ""));
}

/** Per-client key: an IPv4 address as is (mapped addresses unwrapped); the /64 prefix for IPv6. */
export const perIp = (ip: string): string => {
  const a = unmap(ip);
  const g = ipv6Groups(a);
  return g ? `${g.slice(0, 4).join(":")}::/64` : a;
};

/** "203.0.113.0/24" for IPv4; the /48 ("2001:db8:1::/48") for IPv6; anything else unchanged. */
export const slash24 = (ip: string): string => {
  const a = unmap(ip);
  if (isIP(a) === 4) {
    const p = a.split(".");
    return `${p[0]}.${p[1]}.${p[2]}.0/24`;
  }
  const g = ipv6Groups(a);
  return g ? `${g.slice(0, 3).join(":")}::/48` : ip;
};
