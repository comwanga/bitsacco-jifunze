import { isIP } from "node:net";

/** In-memory fixed-window limiter. A restart resets the counts. */
export type Rule = { name: string; key: (ip: string) => string; limit: number; windowMs: number };

export class Limiter {
  private readonly rules: Rule[];
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(rules: Rule[]) {
    this.rules = rules;
  }

  /** Counts the request against every rule; false means at least one limit is exceeded. */
  hit(ip: string): boolean {
    const now = Date.now();
    if (this.buckets.size > 10_000) {
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

/** "203.0.113.0/24" for IPv4; the /48 ("2001:db8:1::/48") for IPv6; anything else unchanged. */
export const slash24 = (ip: string): string => {
  const a = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const v = isIP(a);
  if (v === 4) {
    const p = a.split(".");
    return `${p[0]}.${p[1]}.${p[2]}.0/24`;
  }
  if (v === 6) {
    const [head = "", tail] = a.split("::");
    const h = head === "" ? [] : head.split(":");
    const t = tail === undefined || tail === "" ? [] : tail.split(":");
    const groups = tail === undefined ? h : [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
    const first = groups.slice(0, 3).map((g) => (g || "0").toLowerCase().replace(/^0+(?=.)/, ""));
    return `${first.join(":")}::/48`;
  }
  return ip;
};
