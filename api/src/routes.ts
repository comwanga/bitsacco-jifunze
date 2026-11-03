import type { Route } from "./http.ts";
import { githubRoutes } from "./github-routes.ts";
import { logoutRoute, meRoute } from "./sessions.ts";

export const healthRoute: Route = {
  method: "GET",
  path: "/api/health",
  auth: "public",
  handler: async () => ({ status: 200, json: { ok: true } }),
};

export const routes: Route[] = [healthRoute, meRoute, logoutRoute, ...githubRoutes()];
