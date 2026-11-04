import { createHash, randomBytes } from "node:crypto";
import { logEvent, replaceGithubIdentity, signInWithGithub } from "./accounts.ts";
import { consumeChallenge, createChallenge, peekLang, safeReturn } from "./challenges.ts";
import { ApiError, type ErrorCode } from "./errors.ts";
import { authorizeUrl, githubIdentity } from "./github.ts";
import { PREAUTH_COOKIE, SESSION_COOKIE, type Ctx, type Reply, type Route, type Session } from "./http.ts";
import { Limiter, perIp } from "./ratelimit.ts";
import { markReauth, readSession } from "./sessions.ts";

type Lang = "sw" | "en";
type Purpose = "signin" | "reauth" | "replace";
type Challenge = NonNullable<Awaited<ReturnType<typeof consumeChallenge>>>;

const COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Lax; Path=/";
const clearPreauth = `${PREAUTH_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
const asLang = (v: string | null): Lang | null => (v === "sw" || v === "en" ? v : null);
const asPurpose = (v: string | null): Purpose | null =>
  v === "signin" || v === "reauth" || v === "replace" ? v : null;
const signinError = (lang: Lang, code: ErrorCode): string => `/${lang}/account/signin/?error=${code}`;
const accountError = (lang: Lang, code: ErrorCode): string => `/${lang}/account/?error=${code}`;

/**
 * Each purpose has its own callback path, a subdirectory of the registered GitHub callback URL, so a
 * challenge can only complete the flow it was started for: the route's purpose must equal the stored one.
 */
const CALLBACK = "/api/auth/github/callback";
const callbackPath = (p: Purpose): string => (p === "signin" ? CALLBACK : `${CALLBACK}/${p}`);

/** Signed-in flows report errors on the account page, except a missing session, which needs the sign-in page. */
const errorPage = (p: Purpose, lang: Lang, code: ErrorCode): string =>
  p === "signin" || code === "unauthenticated" ? signinError(lang, code) : accountError(lang, code);

export const GITHUB_START_RULE = { name: "github-start-ip", key: perIp, limit: 30, windowMs: 600_000 };

/**
 * The callback's session is the one the challenge was started from, still live, on the same account,
 * and of the scope the purpose needs. A session row's scope never changes, so for replace the token
 * match alone pins the scope used at start (recovery, or full).
 */
function bound(s: Session | null, ch: Challenge, purpose: Purpose): s is Session {
  if (!s || !ch.sessionTokenHash || !ch.accountId) return false;
  if (!s.tokenHash.equals(ch.sessionTokenHash) || s.accountId !== ch.accountId) return false;
  return purpose === "reauth" ? s.scope === "full" : s.scope === "full" || s.scope === "recovery";
}

export function githubRoutes(
  limiter: Limiter = new Limiter([GITHUB_START_RULE]),
): Route[] {
  const start: Route = {
    method: "GET",
    path: "/api/auth/github/start",
    auth: "public",
    // replace must be reachable from a recovery session; the per-purpose rules are enforced below.
    recoveryAllowed: true,
    handler: async ({ query, ip, fetchSite, sql, cfg, session }) => {
      const lang = asLang(query.get("lang")) ?? "sw";
      if (!limiter.hit(ip)) return { status: 302, redirect: signinError(lang, "rate_limited") };
      const purpose = asPurpose(query.get("purpose"));
      if (!purpose) throw new ApiError(400, "bad_request");
      // reauth and replace change state (a challenge bound to the session), and SameSite=Lax sends the session
      // cookie on a top-level cross-site navigation: refuse one when the browser says so. A missing header
      // (older browsers) is allowed. signin must keep working from external links.
      if (purpose !== "signin" && fetchSite !== undefined && fetchSite !== "same-origin" && fetchSite !== "none") {
        return { status: 302, redirect: accountError(lang, "bad_origin") };
      }

      let binding: { accountId: string; sessionTokenHash: Buffer } | undefined;
      if (purpose !== "signin") {
        const suitable = session && (purpose === "replace" || session.scope === "full");
        if (!suitable) return { status: 302, redirect: signinError(lang, "unauthenticated") };
        if (purpose === "replace" && session.scope === "full") {
          // Checked in the database: a stale copy of reauth_at must not open the window.
          const fresh = await sql`
            select 1 from sessions where token_hash = ${session.tokenHash} and reauth_at > now() - interval '10 minutes'`;
          if (fresh.length === 0) return { status: 302, redirect: accountError(lang, "reauth_required") };
        }
        binding = { accountId: session.accountId, sessionTokenHash: session.tokenHash };
      }

      const verifier = randomBytes(32).toString("base64url");
      const { secret, preauth } = await createChallenge(sql, {
        purpose,
        provider: "github",
        ...binding,
        lang,
        returnTo: safeReturn(query.get("return"), lang),
        pkceVerifier: verifier,
      });
      const location = authorizeUrl(cfg, {
        state: secret,
        codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
        redirectUri: `${cfg.siteOrigin}${callbackPath(purpose)}`,
      });
      return {
        status: 302,
        redirect: location,
        setCookies: [`${PREAUTH_COOKIE}=${preauth}; ${COOKIE_ATTRS}; Max-Age=600`],
      };
    },
  };

  const callback = (purpose: Purpose): Route => ({
    method: "GET",
    path: callbackPath(purpose),
    auth: "public",
    handler: async (ctx) => {
      const state = { lang: asLang(ctx.query.get("lang")) ?? ("sw" as Lang) };
      const fail = (code: ErrorCode): Reply => ({
        status: 302,
        redirect: errorPage(purpose, state.lang, code),
        setCookies: [clearPreauth],
      });
      // A top-level navigation: every failure, expected or not, ends in a redirect with the pre-auth cookie cleared.
      try {
        return await completeCallback(ctx, purpose, state, fail);
      } catch (e) {
        if (e instanceof ApiError) return fail(e.code);
        ctx.logError(e);
        return fail("internal");
      }
    },
  });

  return [start, callback("signin"), callback("reauth"), callback("replace")];
}

async function completeCallback(
  { query, cookies, sql, cfg, session }: Ctx,
  purpose: Purpose,
  state: { lang: Lang },
  fail: (code: ErrorCode) => Reply,
): Promise<Reply> {
  const secret = query.get("state") ?? "";
  const preauth = cookies[PREAUTH_COOKIE] ?? "";

  const err = query.get("error");
  if (err) {
    // The user said no (or GitHub failed): nothing changes; the challenge is left to expire.
    state.lang = (await peekLang(sql, { secret, preauth })) ?? state.lang;
    return fail(err === "access_denied" ? "github_denied" : "github_failed");
  }
  const code = query.get("code");
  if (!code || code.length > 512) return fail("state_invalid");

  // Single use: a replayed or reused challenge is gone. A challenge of another purpose is refused (and burned).
  const ch = await consumeChallenge(sql, { secret, preauth, provider: "github" });
  if (!ch || ch.purpose !== purpose) return fail("state_invalid");
  state.lang = ch.lang;

  // Correction B, first pass: refuse a wrong session before the code is even exchanged.
  if (purpose !== "signin" && !bound(session, ch, purpose)) return fail("unauthenticated");

  const gh = await githubIdentity(cfg, {
    code,
    codeVerifier: ch.pkceVerifier,
    redirectUri: `${cfg.siteOrigin}${callbackPath(purpose)}`,
  });

  if (purpose === "signin") {
    const r = await signInWithGithub(sql, gh, ch.lang, session);
    return {
      status: 302,
      redirect: r.created ? `/${ch.lang}/account/welcome/` : ch.returnTo,
      setCookies: [r.cookie, clearPreauth],
    };
  }

  // Correction B, second pass: re-read the session after the GitHub round trip, before any change.
  const live = await readSession(sql, cookies[SESSION_COOKIE]);
  if (!bound(live, ch, purpose)) return fail("unauthenticated");

  if (purpose === "reauth") {
    // Correction A: only the GitHub account already linked (by numeric id) can confirm it is you.
    const [linked] = await sql<{ provider_uid: string }[]>`
      select provider_uid from identities where account_id = ${live.accountId} and provider = 'github'`;
    if (!linked || linked.provider_uid !== String(gh.id)) return fail("reauth_mismatch");
    // reauth_at and its event commit together.
    await sql.begin(async (tx) => {
      if (!(await markReauth(tx, live.tokenHash))) throw new ApiError(401, "unauthenticated");
      await logEvent(tx, live.accountId, "reauth", { provider: "github" });
    });
    return { status: 302, redirect: ch.returnTo, setCookies: [clearPreauth] };
  }

  // replace: one transaction re-checks the binding under the row locks, switches the identity,
  // revokes every session of the account and issues the fresh full session.
  const { cookie } = await replaceGithubIdentity(sql, live.accountId, gh, { tokenHash: live.tokenHash, scope: live.scope });
  return { status: 302, redirect: `/${ch.lang}/account/?replaced=github`, setCookies: [cookie, clearPreauth] };
}
