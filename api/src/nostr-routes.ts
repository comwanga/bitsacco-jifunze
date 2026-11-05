import { z } from "zod";
import { signInWithNostr } from "./accounts.ts";
import { identityAllowed } from "./allowlist.ts";
import { consumeNostrChallenge, createNostrChallenge, safeReturn } from "./challenges.ts";
import { ApiError } from "./errors.ts";
import { PREAUTH_COOKIE, type Route } from "./http.ts";
import { verifyNostr } from "./nostr.ts";
import { Limiter, perIp } from "./ratelimit.ts";

const VERIFY_PATH = "/api/auth/nostr/verify";
const COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Lax; Path=/";
const challengeBody = z.object({ lang: z.enum(["sw", "en"]), returnTo: z.string().max(200).optional() }).strict();
const proofBody = z.object({ challengeId: z.uuid(), nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

export function nostrRoutes(
  starts = new Limiter([{ name: "nostr-start", key: perIp, limit: 30, windowMs: 600_000 }]),
  verifies = new Limiter([{ name: "nostr-verify", key: perIp, limit: 120, windowMs: 60_000 }]),
): Route[] {
  return [{
    method: "POST", path: "/api/auth/nostr/challenge", auth: "public", body: challengeBody,
    handler: async ({ body, sql, cfg, ip }) => {
      if (!starts.hit(ip)) throw new ApiError(429, "rate_limited");
      const { lang, returnTo } = body as z.infer<typeof challengeBody>;
      const ch = await createNostrChallenge(sql, lang, safeReturn(returnTo ?? null, lang));
      return { status: 200, json: { challengeId: ch.challengeId, nonce: ch.nonce, url: cfg.siteOrigin + VERIFY_PATH },
        setCookies: [`${PREAUTH_COOKIE}=${ch.preauth}; ${COOKIE_ATTRS}; Max-Age=300`] };
    },
  }, {
    method: "POST", path: VERIFY_PATH, auth: "public",
    // No router JSON parsing here: verify the event first, including its exact raw-body digest.
    handler: async ({ authorization, rawBody, requestTarget, cfg, cookies, sql, session, ip }) => {
      if (!verifies.hit(ip)) throw new ApiError(429, "rate_limited");
      const pubkey = verifyNostr(authorization, rawBody, cfg.siteOrigin + VERIFY_PATH);
      if (requestTarget !== VERIFY_PATH) throw new ApiError(401, "nostr_invalid");
      let parsed: unknown;
      try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)); } catch { throw new ApiError(401, "nostr_invalid"); }
      const proof = proofBody.safeParse(parsed);
      if (!proof.success) throw new ApiError(401, "nostr_invalid");
      const preauth = cookies[PREAUTH_COOKIE] ?? "";
      if (!identityAllowed(cfg.testerAllowlist, "nostr", pubkey)) {
        // Spent like any other proof, and answered as a spent challenge is.
        await consumeNostrChallenge(sql, proof.data.challengeId, proof.data.nonce, preauth);
        throw new ApiError(401, "challenge_invalid");
      }
      const result = await signInWithNostr(sql, pubkey, { ...proof.data, preauth }, session);
      return { status: 200, json: { redirect: result.redirect }, setCookies: [result.cookie, `${PREAUTH_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`] };
    },
  }];
}
