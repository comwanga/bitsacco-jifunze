import { z } from "zod";
import { deleteAccount } from "./accounts.ts";
import { ApiError } from "./errors.ts";
import type { Route } from "./http.ts";
import { Limiter, perIp } from "./ratelimit.ts";
import { clearSessionCookie } from "./sessions.ts";

/**
 * Account deletion. A full session only (never a recovery session), an explicit confirmation in the body, and a
 * re-authentication within the last 10 minutes, which deleteAccount checks inside its transaction.
 */
export function deleteAccountRoute(
  limiter: Limiter = new Limiter([{ name: "account-delete", key: perIp, limit: 10, windowMs: 900_000 }]),
): Route {
  return {
    method: "POST",
    path: "/api/me/delete",
    auth: "full",
    body: z.object({ confirm: z.literal(true) }).strict(),
    handler: async ({ sql, session, ip }) => {
      if (!limiter.hit(ip)) throw new ApiError(429, "rate_limited");
      await deleteAccount(sql, session!);
      return { status: 204, setCookies: [clearSessionCookie] };
    },
  };
}
