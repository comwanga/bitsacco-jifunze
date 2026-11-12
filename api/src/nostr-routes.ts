import { z } from "zod";
import { reauthWithNostr, replaceNostrIdentity, signInWithNostr } from "./accounts.ts";
import { identityAllowed } from "./allowlist.ts";
import { consumeNostrChallenge, createNostrChallenge, safeReturn } from "./challenges.ts";
import { ApiError } from "./errors.ts";
import { PREAUTH_COOKIE, type Ctx, type Route } from "./http.ts";
import { verifyNostr } from "./nostr.ts";
import { Limiter, perIp } from "./ratelimit.ts";

// One verification URL per purpose: the signed event's `u` tag then states what the signer approved, so a proof
// made for signing in can never be replayed as a re-authentication or a key replacement.
const PATHS = {
  signin: "/api/auth/nostr/verify",
  reauth: "/api/auth/nostr/reauth",
  replace: "/api/auth/nostr/replace",
} as const;
type Purpose = keyof typeof PATHS;

const COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Lax; Path=/";
const clearPreauth = `${PREAUTH_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
const challengeBody = z.object({
  lang: z.enum(["sw", "en"]),
  returnTo: z.string().max(200).optional(),
  purpose: z.enum(["signin", "reauth", "replace"]).optional(),
  remote: z.literal(true).optional(),
}).strict();
const proofBody = z.object({ challengeId: z.uuid(), nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

/**
 * Verifies the event first, including its exact raw-body digest and the purpose's own URL; only a proven event
 * reaches the challenge. No router JSON parsing on these routes.
 */
function proven(ctx: Ctx, purpose: Purpose): { pubkey: string; proof: { challengeId: string; nonce: string; preauth: string } } {
  const path = PATHS[purpose];
  const pubkey = verifyNostr(ctx.authorization, ctx.rawBody, ctx.cfg.siteOrigin + path);
  if (ctx.requestTarget !== path) throw new ApiError(401, "nostr_invalid");
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(ctx.rawBody)); } catch { throw new ApiError(401, "nostr_invalid"); }
  const proof = proofBody.safeParse(parsed);
  if (!proof.success) throw new ApiError(401, "nostr_invalid");
  return { pubkey, proof: { ...proof.data, preauth: ctx.cookies[PREAUTH_COOKIE] ?? "" } };
}

export function nostrRoutes(
  starts = new Limiter([{ name: "nostr-start", key: perIp, limit: 30, windowMs: 600_000 }]),
  verifies = new Limiter([{ name: "nostr-verify", key: perIp, limit: 120, windowMs: 60_000 }]),
  replaces = new Limiter([{ name: "nostr-replace", key: perIp, limit: 10, windowMs: 900_000 }]),
): Route[] {
  return [{
    method: "POST", path: "/api/auth/nostr/challenge", auth: "public", body: challengeBody,
    handler: async ({ body, sql, cfg, ip, session }) => {
      if (!starts.hit(ip)) throw new ApiError(429, "rate_limited");
      const { lang, returnTo, purpose = "signin", remote } = body as z.infer<typeof challengeBody>;
      let binding: { accountId: string; sessionTokenHash: Buffer } | undefined;
      if (purpose !== "signin") {
        // The challenge belongs to the session that asks for it. Re-authentication is for a full session only;
        // replacement also from a recovery session (its freshness rule is checked when the proof arrives).
        if (!session) throw new ApiError(401, "unauthenticated");
        if (purpose === "reauth" && session.scope !== "full") throw new ApiError(403, "recovery_scope");
        binding = { accountId: session.accountId, sessionTokenHash: session.tokenHash };
      }
      const lifetime = remote ? 120 : 300;
      const ch = await createNostrChallenge(sql, lang, safeReturn(returnTo ?? null, lang), purpose, binding, lifetime);
      return { status: 200, json: { challengeId: ch.challengeId, nonce: ch.nonce, url: cfg.siteOrigin + PATHS[purpose] },
        setCookies: [`${PREAUTH_COOKIE}=${ch.preauth}; ${COOKIE_ATTRS}; Max-Age=${lifetime}`] };
    },
  }, {
    method: "POST", path: PATHS.signin, auth: "public",
    handler: async (ctx) => {
      if (!verifies.hit(ctx.ip)) throw new ApiError(429, "rate_limited");
      const { pubkey, proof } = proven(ctx, "signin");
      if (!identityAllowed(ctx.cfg.testerAllowlist, "nostr", pubkey)) {
        // Spent like any other proof, and answered as a spent challenge is.
        await consumeNostrChallenge(ctx.sql, proof.challengeId, proof.nonce, proof.preauth);
        throw new ApiError(401, "challenge_invalid");
      }
      const result = await signInWithNostr(ctx.sql, pubkey, proof, ctx.session);
      return { status: 200, json: { redirect: result.redirect }, setCookies: [result.cookie, clearPreauth] };
    },
  }, {
    // Confirms that the person at this session still holds the account's key, for sensitive actions.
    method: "POST", path: PATHS.reauth, auth: "full",
    handler: async (ctx) => {
      if (!verifies.hit(ctx.ip)) throw new ApiError(429, "rate_limited");
      const { pubkey, proof } = proven(ctx, "reauth");
      await reauthWithNostr(ctx.sql, pubkey, proof, ctx.session!);
      return { status: 204, setCookies: [clearPreauth] };
    },
  }, {
    // Attaches a newly proven key to this session's account: after a recovery code, or from a re-authenticated
    // full session. The old key stops working for this account, and so does every earlier recovery code.
    method: "POST", path: PATHS.replace, auth: "any", recoveryAllowed: true,
    handler: async (ctx) => {
      if (!replaces.hit(ctx.ip)) throw new ApiError(429, "rate_limited");
      const { pubkey, proof } = proven(ctx, "replace");
      const session = ctx.session!;
      if (!identityAllowed(ctx.cfg.testerAllowlist, "nostr", pubkey)) {
        await consumeNostrChallenge(ctx.sql, proof.challengeId, proof.nonce, proof.preauth, "replace",
          { accountId: session.accountId, tokenHash: session.tokenHash });
        throw new ApiError(401, "challenge_invalid");
      }
      const result = await replaceNostrIdentity(ctx.sql, ctx.cfg, pubkey, proof, session);
      // The new recovery codes are shown once, here; every earlier code has stopped working.
      return { status: 200, json: { redirect: result.returnTo, outcome: result.outcome, codes: result.codes }, setCookies: [result.cookie, clearPreauth] };
    },
  }];
}
