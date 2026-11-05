import { ApiError } from "./errors.ts";
import type { Route } from "./http.ts";
import { githubRoutes } from "./github-routes.ts";
import { nostrRoutes } from "./nostr-routes.ts";
import { recoveryRoutes } from "./recovery.ts";
import { logoutRoute, meRoute } from "./sessions.ts";

export const healthRoute: Route = {
  method: "GET",
  path: "/api/health",
  auth: "public",
  handler: async () => ({ status: 200, json: { ok: true } }),
};

/**
 * Asked by the Railway nginx before every API request while authentication is enabled. A deployment without the
 * allowlist has no such route, so it cannot serve authentication. Hidden from the public by nginx's /api/internal/.
 */
export const testerGateRoute: Route = {
  method: "GET",
  path: "/api/internal/tester-gate",
  auth: "public",
  handler: async ({ cfg }) => {
    if (cfg.testerAllowlist === null) throw new ApiError(404, "not_found");
    return { status: 204 };
  },
};

export const routes: Route[] = [healthRoute, testerGateRoute, meRoute, logoutRoute, ...githubRoutes(), ...nostrRoutes(), ...recoveryRoutes()];
