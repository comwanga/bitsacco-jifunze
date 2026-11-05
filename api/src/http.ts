import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isIP } from "node:net";
import type { ZodType } from "zod";
import type { Config } from "./config.ts";
import { normaliseIp } from "./ratelimit.ts";
import { ApiError, MESSAGES, type ErrorCode } from "./errors.ts";

export type Sql = import("postgres").Sql;

export type Session = { tokenHash: Buffer; accountId: string; scope: "full" | "recovery"; reauthAt: Date };
export type ReadSession = (sql: Sql, cookieValue: string | undefined) => Promise<Session | null>;
export type Auth = "public" | "full" | "any"; // "any" = a full or recovery session
export type Route = {
  method: "GET" | "POST";
  path: string;
  auth: Auth;
  recoveryAllowed?: boolean;
  body?: ZodType;
  handler: (ctx: Ctx) => Promise<Reply>;
};
export type Ctx = {
  authorization: string | undefined;
  rawBody: Buffer;
  requestTarget: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  cookies: Record<string, string>;
  ip: string;
  /** The Sec-Fetch-Site request header, when the browser sent one. */
  fetchSite: string | undefined;
  session: Session | null;
  cfg: Config;
  sql: Sql;
  /** Reports an unexpected error the handler turned into a reply: name, stack, method and route template only. */
  logError: (err: unknown) => void;
};
export type Reply = { status: number; json?: unknown; redirect?: string; setCookies?: string[] };

export type LogLine = { method: string; route: string; status: number; ms: number; accountId?: string };
export type ErrorLogLine = { method: string; route: string; name: string; stack: string };
export type Deps = {
  cfg: Config;
  sql: Sql;
  readSession: ReadSession;
  log?: (line: LogLine) => void;
  logError?: (line: ErrorLogLine) => void;
};

export const SESSION_COOKIE = "__Host-jf_session";
export const PREAUTH_COOKIE = "__Host-jf_preauth";
export const MAX_BODY_BYTES = 16 * 1024;

function defaultLog(line: LogLine): void {
  console.info(JSON.stringify(line));
}

function defaultLogError(line: ErrorLogLine): void {
  console.error(JSON.stringify(line));
}

function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Vary", "Cookie");
}

function isPrivateAddress(addr: string): boolean {
  const a = addr.startsWith("::ffff:") ? addr.slice(7) : addr;
  if (a === "::1") return true;
  if (isIP(a) === 4) {
    const [p, q] = a.split(".").map(Number) as [number, number];
    return p === 127 || p === 10 || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168);
  }
  if (isIP(a) === 6) return /^f[cd]/i.test(a); // unique local fc00::/7
  return false;
}

/** The client IP: X-Real-IP only when the socket peer is loopback or private (our proxy), else the socket. */
export function clientIp(remote: string | undefined, realIp: string | undefined): string {
  const socketIp = remote ?? "";
  if (realIp && isPrivateAddress(socketIp) && isIP(realIp.trim()) !== 0) return normaliseIp(realIp.trim());
  return normaliseIp(socketIp);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    let v = part.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1);
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

type Matched = { route: Route; params: Record<string, string> };

function matchPath(template: string, path: string): Record<string, string> | null {
  const t = template.split("/");
  const p = path.split("/");
  if (t.length !== p.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < t.length; i++) {
    const seg = t[i] as string;
    const val = p[i] as string;
    if (seg.startsWith(":")) {
      if (val === "") return null;
      try {
        params[seg.slice(1)] = decodeURIComponent(val);
      } catch {
        return null;
      }
    } else if (seg !== val) return null;
  }
  return params;
}

function sendError(res: ServerResponse, status: number, code: ErrorCode): void {
  sendJson(res, status, { error: { code, message_sw: MESSAGES[code].sw, message_en: MESSAGES[code].en } });
}

function sendJson(res: ServerResponse, status: number, json: unknown): void {
  const text = JSON.stringify(json);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(text));
  res.end(text);
}

/** Reads at most MAX_BODY_BYTES; throws payload_too_large without consuming the rest of the stream. */
async function readBody(req: IncomingMessage): Promise<Buffer> {
  const declared = req.headers["content-length"];
  if (declared !== undefined && Number(declared) > MAX_BODY_BYTES) throw new ApiError(413, "payload_too_large");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) {
      req.pause();
      throw new ApiError(413, "payload_too_large");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function isJsonContentType(value: string | undefined): boolean {
  if (!value) return false;
  return /^application\/json\s*(;|$)/i.test(value.trim());
}

export function createServer(routes: Route[], deps: Deps): Server {
  const { cfg, sql, readSession } = deps;
  const log = deps.log ?? defaultLog;
  const logError = deps.logError ?? defaultLogError;

  return createHttpServer((req, res) => {
    const started = Date.now();
    let routeTemplate = "(unmatched)";
    let accountId: string | undefined;
    res.once("finish", () => {
      const line: LogLine = { method: req.method ?? "", route: routeTemplate, status: res.statusCode, ms: Date.now() - started };
      if (accountId) line.accountId = accountId;
      log(line);
    });

    // Method and route template only: never bodies, headers, cookies, query or IP.
    const report = (err: unknown): void => {
      const e = err instanceof Error ? err : new Error(String(err));
      logError({ method: req.method ?? "", route: routeTemplate, name: e.name, stack: e.stack ?? e.message });
    };

    handle().catch((err: unknown) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (err instanceof ApiError) sendError(res, err.status, err.code);
      else {
        report(err);
        sendError(res, 500, "internal");
      }
    });

    async function handle(): Promise<void> {
      // 1. headers
      setSecurityHeaders(res);

      // 2. match
      const url = new URL(req.url ?? "/", "http://internal");
      const method = req.method ?? "";
      const candidates: Matched[] = [];
      for (const route of routes) {
        const params = matchPath(route.path, url.pathname);
        if (params) candidates.push({ route, params });
      }
      if (candidates.length === 0) throw new ApiError(404, "not_found");
      const hit = candidates.find((c) => c.route.method === method);
      if (!hit) throw new ApiError(405, "method_not_allowed");
      const { route, params } = hit;
      routeTemplate = route.path;

      // 3. origin check (non-GET)
      if (method !== "GET") {
        if (req.headers.origin !== cfg.siteOrigin || req.headers["x-jifunze"] !== "1") {
          throw new ApiError(403, "bad_origin");
        }
      }

      // 4. size and content type
      let raw: Buffer = Buffer.alloc(0);
      if (method !== "GET") {
        raw = await readBody(req);
        if (raw.length > 0 && !isJsonContentType(req.headers["content-type"])) throw new ApiError(400, "bad_request");
      }

      // 5. session (before the body is parsed, so an anonymous request never reaches validation)
      const cookies = parseCookies(req.headers.cookie);
      const session = await readSession(sql, cookies[SESSION_COOKIE]);
      if (session) accountId = session.accountId;
      if (route.auth !== "public") {
        if (!session) throw new ApiError(401, "unauthenticated");
        // A recovery session reaches only routes that opt in, whether auth is "full" or "any".
        if (session.scope === "recovery" && !route.recoveryAllowed) throw new ApiError(403, "recovery_scope");
      }

      // 6. zod
      let body: unknown = undefined;
      if (route.body) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString("utf8"));
        } catch {
          throw new ApiError(400, "bad_request");
        }
        const result = route.body.safeParse(parsed);
        if (!result.success) throw new ApiError(400, "bad_request");
        body = result.data;
      }

      // 7. handler
      const reply = await route.handler({
        authorization: headerValue(req.headers.authorization),
        rawBody: raw,
        requestTarget: req.url ?? "",
        params,
        query: url.searchParams,
        body,
        cookies,
        ip: clientIp(req.socket.remoteAddress, headerValue(req.headers["x-real-ip"])),
        fetchSite: headerValue(req.headers["sec-fetch-site"]),
        session,
        cfg,
        sql,
        logError: report,
      });

      if (reply.setCookies && reply.setCookies.length > 0) res.setHeader("Set-Cookie", reply.setCookies);
      if (reply.redirect) {
        res.statusCode = reply.status;
        res.setHeader("Location", reply.redirect);
        res.end();
        return;
      }
      if (reply.json !== undefined) sendJson(res, reply.status, reply.json);
      else {
        res.statusCode = reply.status;
        res.end();
      }
    }
  });
}

function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
