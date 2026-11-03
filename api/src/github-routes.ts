import { createHash, randomBytes } from "node:crypto";
import { findOrCreateByGithub, logEvent } from "./accounts.ts";
import { consumeChallenge, createChallenge, peekLang, safeReturn } from "./challenges.ts";
import { ApiError, type ErrorCode } from "./errors.ts";
import { authorizeUrl, githubIdentity } from "./github.ts";
import { PREAUTH_COOKIE, type Reply, type Route } from "./http.ts";
import { Limiter, perIp } from "./ratelimit.ts";
import { createSession, revokeSession } from "./sessions.ts";

type Lang = "sw" | "en";
const COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Lax; Path=/";
const clearPreauth = `${PREAUTH_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
const asLang = (v: string | null): Lang | null => (v === "sw" || v === "en" ? v : null);
const signinError = (lang: Lang, code: ErrorCode): string => `/${lang}/account/signin/?error=${code}`;

export const GITHUB_START_RULE = { name: "github-start-ip", key: perIp, limit: 30, windowMs: 600_000 };

export function githubRoutes(
  limiter: Limiter = new Limiter([GITHUB_START_RULE]),
): Route[] {
  const start: Route = {
    method: "GET",
    path: "/api/auth/github/start",
    auth: "public",
    handler: async ({ query, ip, sql, cfg }) => {
      const lang = asLang(query.get("lang")) ?? "sw";
      if (!limiter.hit(ip)) return { status: 302, redirect: signinError(lang, "rate_limited") };
      if (query.get("purpose") !== "signin") throw new ApiError(400, "bad_request");
      const verifier = randomBytes(32).toString("base64url");
      const { secret, preauth } = await createChallenge(sql, {
        purpose: "signin",
        provider: "github",
        lang,
        returnTo: safeReturn(query.get("return"), lang),
        pkceVerifier: verifier,
      });
      const location = authorizeUrl(cfg, {
        state: secret,
        codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
        redirectUri: `${cfg.siteOrigin}/api/auth/github/callback`,
      });
      return {
        status: 302,
        redirect: location,
        setCookies: [`${PREAUTH_COOKIE}=${preauth}; ${COOKIE_ATTRS}; Max-Age=600`],
      };
    },
  };

  const callback: Route = {
    method: "GET",
    path: "/api/auth/github/callback",
    auth: "public",
    handler: async ({ query, cookies, sql, cfg, session }) => {
      const state = query.get("state") ?? "";
      const preauth = cookies[PREAUTH_COOKIE] ?? "";
      let lang: Lang = asLang(query.get("lang")) ?? "sw";
      const fail = (code: ErrorCode): Reply => ({
        status: 302,
        redirect: signinError(lang, code),
        setCookies: [clearPreauth],
      });

      const err = query.get("error");
      if (err) {
        // The user said no (or GitHub failed): no account; the challenge is left to expire.
        lang = (await peekLang(sql, { secret: state, preauth })) ?? lang;
        return fail(err === "access_denied" ? "github_denied" : "github_failed");
      }
      const code = query.get("code");
      if (!code || code.length > 512) return fail("state_invalid");

      const ch = await consumeChallenge(sql, { secret: state, preauth, provider: "github" });
      if (!ch || ch.purpose !== "signin") return fail("state_invalid");
      lang = ch.lang;

      let gh;
      try {
        gh = await githubIdentity(cfg, {
          code,
          codeVerifier: ch.pkceVerifier,
          redirectUri: `${cfg.siteOrigin}/api/auth/github/callback`,
        });
      } catch (e) {
        if (e instanceof ApiError) return fail(e.code);
        throw e;
      }

      const { accountId, created } = await findOrCreateByGithub(sql, gh, ch.lang);
      const fresh = await createSession(sql, accountId, "full");
      if (session) await revokeSession(sql, session.tokenHash);
      await logEvent(sql, accountId, "signin", { provider: "github", created: String(created) });
      return {
        status: 302,
        redirect: created ? `/${ch.lang}/account/welcome/` : ch.returnTo,
        setCookies: [fresh.cookie, clearPreauth],
      };
    },
  };

  return [start, callback];
}
