import type { Lang } from "@/lib/i18n";

/** What a request to the account API came back with. `code` is an API ErrorCode, or "network" when the API could not be reached. */
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string };

export type Me = {
  scope: "full" | "recovery";
  account: { id: string; preferredLang: string; recoveryCodesIssued: boolean };
  identities: { provider: "github"; handle: string | null; avatarUrl: string | null; linkedAt: string }[];
  notices: { type: "recovery_code_used"; at: string }[];
};

/**
 * Every account request goes through here: same origin, with the session cookie and the X-Jifunze header the
 * API requires. Never throws. An error body that is not the API's JSON shape (a proxy page, or no API at all)
 * counts as "network", because the account service was not reached.
 */
export async function apiFetch<T = unknown>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "X-Jifunze": "1" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: "network" };
  }
  let json: unknown = undefined;
  try {
    if (res.status !== 204) json = await res.json();
  } catch {
    json = undefined;
  }
  if (res.ok) {
    if (res.status !== 204 && json === undefined) return { ok: false, status: res.status, code: "network" };
    return { ok: true, status: res.status, data: json as T };
  }
  const code = (json as { error?: { code?: unknown } } | undefined)?.error?.code;
  return { ok: false, status: res.status, code: typeof code === "string" ? code : "network" };
}

/** The same rule as the API's safeReturn, so the link carries only a return path the API will accept. */
export function safeReturn(lang: Lang, path: string | null | undefined): string {
  if (!path || path.length > 200 || !/^\/(sw|en)\/[a-z0-9/_-]*$/.test(path) || path.includes("..") || path.includes("//")) {
    return `/${lang}/account/`;
  }
  return path;
}

/** A plain navigation to the GitHub flow (never a fetch: it ends in redirects to GitHub and back). */
export function githubStart(purpose: "signin" | "reauth" | "replace", lang: Lang, returnTo: string): string {
  return `/api/auth/github/start?${new URLSearchParams({ purpose, lang, return: safeReturn(lang, returnTo) })}`;
}

/** One query parameter of the current page, read in the browser (the pages are static, so never on the server). */
export function queryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export function formatDate(lang: Lang, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "sw" ? "sw-KE" : "en-GB", { dateStyle: "long", timeStyle: "short" }).format(d);
}
