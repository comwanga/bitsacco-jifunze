/** Public relay destinations only; DNS-to-private-address rebinding cannot be checked in a browser. */
export function relayURL(input: string): string {
  if (typeof input !== "string" || input.length > 256 || /[\s\x00-\x1f\x7f]/.test(input)) throw new Error("relay");
  const u = new URL(input);
  if (u.protocol !== "wss:" || u.username || u.password || u.hash) throw new Error("relay");
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") && !host.includes(":")) throw new Error("relay");
  if (/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)) throw new Error("relay");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0))) throw new Error("relay");
  }
  // Permit global-unicast IPv6 only. This also excludes mapped IPv4, loopback, ULA and link-local addresses.
  if (host.startsWith("[") && !/^\[[23][0-9a-f]{3}:/.test(host)) throw new Error("relay");
  return u.toString();
}
export function relayList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5 || !value.every((x) => typeof x === "string")) throw new Error("relay");
  return [...new Set(value.map(relayURL))];
}
export function bunkerAddress(input: string): { pubkey: string; relays: string[]; secret: string | null } {
  if (input.length > 2048 || /[\s\x00-\x1f\x7f]/.test(input)) throw new Error("address");
  const u = new URL(input);
  if (u.protocol !== "bunker:" || !/^[0-9a-f]{64}$/.test(u.hostname) || u.username || u.password || u.port || u.hash || (u.pathname && u.pathname !== "/")) throw new Error("address");
  if ([...u.searchParams.keys()].some((k) => k !== "relay" && k !== "secret") || u.searchParams.getAll("secret").length > 1) throw new Error("address");
  const secret = u.searchParams.get("secret");
  if (secret && (secret.length > 256 || /[\x00-\x1f\x7f]/.test(secret))) throw new Error("address");
  return { pubkey: u.hostname, relays: relayList(u.searchParams.getAll("relay")), secret };
}

/** A popup can request only a current, same-origin authentication proof. Never arbitrary Nostr events. */
export function authenticationTemplate(value: unknown, origin: string): value is { created_at: number; kind: number; tags: string[][]; content: string } {
  const t = value as { created_at?: unknown; kind?: unknown; tags?: unknown; content?: unknown } | null;
  if (!t || t.kind !== 27235 || t.content !== "" || !Number.isInteger(t.created_at) || Math.abs(Date.now() / 1000 - Number(t.created_at)) > 60 || !Array.isArray(t.tags) || t.tags.length !== 3) return false;
  const tags = t.tags;
  return tags.every((x) => Array.isArray(x) && x.length === 2 && x.every((y: unknown) => typeof y === "string"))
    && ["verify", "reauth", "replace"].some((p) => JSON.stringify(tags[0]) === JSON.stringify(["u", `${origin}/api/auth/nostr/${p}`]))
    && JSON.stringify(tags[1]) === '["method","POST"]' && tags[2][0] === "payload" && /^[0-9a-f]{64}$/.test(tags[2][1]);
}
