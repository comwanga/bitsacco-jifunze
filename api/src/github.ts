import { z } from "zod";
import type { Config } from "./config.ts";
import { ApiError } from "./errors.ts";

const TIMEOUT_MS = 10_000;

export function authorizeUrl(cfg: Config, a: { state: string; codeChallenge: string; redirectUri: string }): string {
  const u = new URL("/login/oauth/authorize", cfg.githubOAuthBase);
  u.searchParams.set("client_id", cfg.githubClientId);
  u.searchParams.set("redirect_uri", a.redirectUri);
  u.searchParams.set("state", a.state);
  u.searchParams.set("code_challenge", a.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

const tokenResponse = z.object({ access_token: z.string().min(1) });
const userResponse = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1).max(39),
  avatar_url: z.union([z.url({ protocol: /^https$/ }), z.literal(""), z.null()]).optional(),
});

/**
 * Exchanges the code and reads the GitHub user once. The access token lives only inside this
 * call frame: it is never returned, logged, stored or put in an error. Every failure is a bare github_failed.
 */
export async function githubIdentity(
  cfg: Config,
  a: { code: string; codeVerifier: string; redirectUri: string },
  fetchFn: typeof fetch = fetch,
): Promise<{ id: number; login: string; avatarUrl: string }> {
  try {
    const tokenRes = await fetchFn(new URL("/login/oauth/access_token", cfg.githubOAuthBase), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.githubClientId,
        client_secret: cfg.githubClientSecret,
        code: a.code,
        code_verifier: a.codeVerifier,
        redirect_uri: a.redirectUri,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!tokenRes.ok) throw new Error("token");
    const token = tokenResponse.parse(await tokenRes.json()).access_token;

    const userRes = await fetchFn(new URL("/user", cfg.githubApiBase), {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!userRes.ok) throw new Error("user");
    const u = userResponse.parse(await userRes.json());
    return { id: u.id, login: u.login, avatarUrl: u.avatar_url ?? "" };
  } catch {
    throw new ApiError(502, "github_failed");
  }
}
