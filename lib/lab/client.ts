// Talks to the learner's lab bridge (lab/jifunze_lab/bridge.py). No React here, so it is testable.
import type { Localized } from "../i18n.ts";

export const DEFAULT_LAB_URL = "http://127.0.0.1:7777";

export type LabConfig = { url: string; token: string };
export type LabNodeStatus = { impl: string; ok: boolean; pubkey?: string; error?: string; blocks?: number };
export type LabStatus = { profile: "lite" | "full"; nodes: Record<string, LabNodeStatus> };
export type RunResult = { stdout: string; stderr: string; exitCode: number; ms: number; timedOut: boolean; truncated: boolean };
export type CheckResult = { id: string; label: Localized; pass: boolean };
export type LabErrorKind = "not-found" | "unauthorized" | "forbidden" | "server";

export class LabError extends Error {
  constructor(
    public kind: LabErrorKind,
    message: string = kind,
  ) {
    super(message);
    this.name = "LabError";
  }
}

async function request<T>(
  c: LabConfig,
  path: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 35_000,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(c.url.replace(/\/$/, "") + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch {
    throw new LabError("not-found");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 429) throw new LabError("unauthorized");
  if (res.status === 403) throw new LabError("forbidden");
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* not JSON */
    }
    throw new LabError("server", msg);
  }
  return (await res.json()) as T;
}

export async function hello(url: string, fetchImpl: typeof fetch = fetch): Promise<{ lab: string; version: string } | null> {
  try {
    const res = await fetchImpl(url.replace(/\/$/, "") + "/hello", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { lab?: string; version?: string };
    return data.lab === "jifunze" && typeof data.version === "string" ? { lab: data.lab, version: data.version } : null;
  } catch {
    return null;
  }
}

export const status = (c: LabConfig, f?: typeof fetch) => request<LabStatus>(c, "/status", undefined, f);

export const run = (
  c: LabConfig,
  body: { exercise: string; node: string; tab: "cli" | "python"; code: string },
  f?: typeof fetch,
) => request<RunResult>(c, "/run", body, f);

export const check = (c: LabConfig, exercise: string, f?: typeof fetch) => request<CheckResult[]>(c, "/check", { exercise }, f);

export const reset = (c: LabConfig, lesson: string, f?: typeof fetch) =>
  request<{ ok: boolean; log: string }>(c, "/reset", { lesson }, f, 300_000);
