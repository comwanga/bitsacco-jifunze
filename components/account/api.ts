import type { ErrorCode } from "../../api/src/errors.ts";
import type { Lang } from "@/lib/i18n";

/** An API ErrorCode, or "network" when the API could not be reached. */
export type ApiErrorCode = ErrorCode | "network";

/** What a request to the account API came back with. */
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: ApiErrorCode };

export type Me = {
  scope: "full" | "recovery";
  account: { id: string; preferredLang: string; recoveryCodesIssued: boolean };
  identities: { provider: "github" | "nostr"; pubkey?: string; handle: string | null; avatarUrl: string | null; linkedAt: string }[];
  notices: { type: "recovery_code_used"; at: string }[];
};

/**
 * Every account request goes through here: same origin, with the session cookie and the X-Jifunze header the
 * API requires. Never throws. An error body that is not the API's JSON shape counts as "network", because the
 * account service was not reached, except a 5xx: a proxy answered, so the reader's own connection works.
 */
export async function apiFetch<T = unknown>(path: string, init: { method?: "GET" | "POST"; body?: unknown; rawBody?: string; authorization?: string } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "X-Jifunze": "1" };
  if (init.body !== undefined || init.rawBody !== undefined) headers["Content-Type"] = "application/json";
  if (init.authorization) headers.Authorization = init.authorization;
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers,
      body: init.rawBody ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
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
  // An unknown code is passed on as is; errorText() shows the general message for it.
  if (typeof code === "string") return { ok: false, status: res.status, code: code as ErrorCode };
  return { ok: false, status: res.status, code: res.status >= 500 ? "internal" : "network" };
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

/** Removes one-time markers such as ?error= from the address bar, keeping the path and any other parameters, so a reload does not repeat their message. */
export function dropQueryParams(names: string[]): void {
  try {
    const url = new URL(window.location.href);
    if (!names.some((n) => url.searchParams.has(n))) return;
    for (const n of names) url.searchParams.delete(n);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* the message is still shown; only a reload would repeat it */
  }
}

export function formatDate(lang: Lang, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "sw" ? "sw-KE" : "en-GB", { dateStyle: "long", timeStyle: "short" }).format(d);
}
