import type { Route } from "./http.ts";

export const healthRoute: Route = {
  method: "GET",
  path: "/api/health",
  auth: "public",
  handler: async () => ({ status: 200, json: { ok: true } }),
};

export const routes: Route[] = [healthRoute];
