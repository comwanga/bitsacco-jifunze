import { expect, test } from "vitest";
import { authenticationTemplate, bunkerAddress, relayList, relayURL } from "../../lib/nostr/remote-policy";

for (const value of ["ws://relay.nsec.app", "wss://localhost/", "wss://app.localhost/", "wss://foo.local/", "wss://db.internal/", "wss://0.1.2.3/", "wss://[::]/", "wss://[ff02::1]/", "wss://127.1/", "wss://2130706433/", "wss://10.0.0.1/", "wss://172.16.0.1/", "wss://192.168.1.1/", "wss://169.254.1.1/", "wss://100.64.1.1/", "wss://224.0.0.1/", "wss://[::1]/", "wss://[::ffff:127.0.0.1]/", "wss://[fe80::1]/", "wss://[fc00::1]/", "wss://user:password@relay.nsec.app", "wss://relay.nsec.app/#secret", "wss://relay.nsec.app/\n", "https://relay.nsec.app"]) {
  test(`rejects unsafe relay ${JSON.stringify(value)}`, () => expect(() => relayURL(value)).toThrow());
}
test("accepts public names, ports and public address literals", () => {
  expect(relayURL("wss://relay.primal.net")).toBe("wss://relay.primal.net/");
  expect(relayURL("wss://relay.nsec.app:4443/path")).toBe("wss://relay.nsec.app:4443/path");
  expect(relayURL("wss://8.8.8.8/")).toBe("wss://8.8.8.8/");
  expect(relayURL("wss://[2001:4860:4860::8888]/")).toBe("wss://[2001:4860:4860::8888]/");
});
test("bounds and deduplicates relay lists", () => {
  expect(relayList(["wss://relay.nsec.app", "wss://relay.nsec.app/"])).toEqual(["wss://relay.nsec.app/"]);
  expect(() => relayList([])).toThrow(); expect(() => relayList(Array(6).fill("wss://relay.nsec.app"))).toThrow();
  expect(() => relayURL("wss://relay.nsec.app/" + "a".repeat(256))).toThrow();
});
test("accepts only bounded bunker addresses, never NIP-05 lookups or secret-key inputs", () => {
  const address = `bunker://${"a".repeat(64)}?relay=wss%3A%2F%2Frelay.nsec.app&secret=one-time`;
  expect(bunkerAddress(address)).toEqual({ pubkey: "a".repeat(64), relays: ["wss://relay.nsec.app/"], secret: "one-time" });
  for (const invalid of ["nsec1fixture", "user@example.org", address + "&secret=other", address + "&url=https://x.org", address.replace("relay.nsec.app", "127.0.0.1")]) expect(() => bunkerAddress(invalid)).toThrow();
});
test("popup signing is limited to fresh, same-origin NIP-98 destinations and exact tags", () => {
  const t = { kind: 27235, content: "", created_at: Math.floor(Date.now() / 1000), tags: [["u", "https://jifunze.example/api/auth/nostr/reauth"], ["method", "POST"], ["payload", "a".repeat(64)]] };
  expect(authenticationTemplate(t, "https://jifunze.example")).toBe(true);
  for (const altered of [{ ...t, kind: 1 }, { ...t, content: "message" }, { ...t, created_at: t.created_at - 61 }, { ...t, tags: [...t.tags, ["extra", "x"]] }, { ...t, tags: [["u", "https://other.example/api/auth/nostr/reauth"], ...t.tags.slice(1)] }]) expect(authenticationTemplate(altered, "https://jifunze.example")).toBe(false);
});
