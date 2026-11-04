import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type FakeUser = { id: number; login: string; avatar_url: string | null };
export type FakeGithub = {
  url: string;
  setNextUser(user: FakeUser): void;
  lastToken(): string | null;
  /** The code and state a real browser would be sent back with, via /login/oauth/authorize. */
  close(): Promise<void>;
};

const sha256b64 = (s: string) => createHash("sha256").update(s).digest("base64url");

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export type FakeGithubOptions = {
  clientId: string;
  clientSecret: string;
  /** Listen on this port (default: any free port). */
  port?: number;
  /**
   * Browser tests only: /login/oauth/authorize shows a consent page with Approve and Deny buttons instead of
   * redirecting at once, so a spec can choose the user (or a denial) in the browser.
   */
  consent?: boolean;
  /** Like a registered GitHub App callback list: any other redirect_uri is refused. Default: any. */
  redirectUris?: string[];
};

/** The consent page's preset users. A spec that needs a user of its own enters an id and login instead. */
export const PRESET_USERS: Record<string, FakeUser> = {
  "1": { id: 1001, login: "octo", avatar_url: "https://avatars.example/u/1001" },
  "2": { id: 2002, login: "hubot", avatar_url: null },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function consentPage(p: { redirect: string; state: string; challenge: string }): string {
  const hidden = (name: string, value: string) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake GitHub (test only)</title></head>
<body><main><h1>Fake GitHub (test only)</h1>
<p>This page stands in for GitHub in browser tests. It is not GitHub and authenticates no one.</p>
<form method="get" action="/login/oauth/authorize/decide">
${hidden("redirect_uri", p.redirect)}${hidden("state", p.state)}${hidden("code_challenge", p.challenge)}
<p><button name="user" value="1">Approve as user 1 (octo, id 1001)</button></p>
<p><button name="user" value="2">Approve as user 2 (hubot, id 2002)</button></p>
<fieldset><legend>Another user</legend>
<p><label>GitHub user id <input name="id" inputmode="numeric"></label></p>
<p><label>GitHub login <input name="login"></label></p>
<p><button name="user" value="custom">Approve as this user</button></p>
</fieldset>
<p><button name="deny" value="1">Deny</button></p>
</form></main></body></html>`;
}

function redirectTo(res: ServerResponse, location: URL): void {
  res.statusCode = 302;
  res.setHeader("Location", location.toString());
  res.end();
}

export async function startFakeGithub(opts: FakeGithubOptions): Promise<FakeGithub> {
  let nextUser: FakeUser = { id: 1001, login: "octo", avatar_url: "https://avatars.example/u/1001" };
  const codes = new Map<string, { challenge: string; user: FakeUser }>();
  const tokens = new Map<string, FakeUser>();
  let last: string | null = null;

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://fake");
      if (req.method === "GET" && url.pathname === "/login/oauth/authorize") {
        const redirect = url.searchParams.get("redirect_uri");
        const challenge = url.searchParams.get("code_challenge");
        if (url.searchParams.get("client_id") !== opts.clientId || !redirect || !challenge) {
          return json(res, 400, { error: "invalid_request" });
        }
        if (url.searchParams.get("code_challenge_method") !== "S256") return json(res, 400, { error: "invalid_request" });
        if (opts.redirectUris && !opts.redirectUris.includes(redirect)) return json(res, 400, { error: "redirect_uri_mismatch" });
        if (opts.consent) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          return res.end(consentPage({ redirect, state: url.searchParams.get("state") ?? "", challenge }));
        }
        const code = `code_${randomBytes(8).toString("hex")}`;
        codes.set(code, { challenge, user: nextUser });
        const back = new URL(redirect);
        back.searchParams.set("code", code);
        back.searchParams.set("state", url.searchParams.get("state") ?? "");
        res.statusCode = 302;
        res.setHeader("Location", back.toString());
        return res.end();
      }
      if (opts.consent && req.method === "GET" && url.pathname === "/login/oauth/authorize/decide") {
        const q = url.searchParams;
        const redirect = q.get("redirect_uri") ?? "";
        const challenge = q.get("code_challenge") ?? "";
        if (!redirect || !challenge || (opts.redirectUris && !opts.redirectUris.includes(redirect))) {
          return json(res, 400, { error: "invalid_request" });
        }
        const back = new URL(redirect);
        if (q.has("deny")) {
          // What GitHub sends when the user cancels the authorization.
          back.searchParams.set("error", "access_denied");
          back.searchParams.set("error_description", "The user has denied your application access.");
          back.searchParams.set("state", q.get("state") ?? "");
          return redirectTo(res, back);
        }
        const choice = q.get("user") ?? "";
        let user = PRESET_USERS[choice];
        if (choice === "custom") {
          const id = Number(q.get("id"));
          const login = q.get("login") ?? "";
          if (!Number.isSafeInteger(id) || id <= 0 || !/^[A-Za-z0-9-]{1,39}$/.test(login)) return json(res, 400, { error: "invalid_user" });
          user = { id, login, avatar_url: null };
        }
        if (!user) return json(res, 400, { error: "invalid_user" });
        const code = `code_${randomBytes(8).toString("hex")}`;
        codes.set(code, { challenge, user });
        back.searchParams.set("code", code);
        back.searchParams.set("state", q.get("state") ?? "");
        return redirectTo(res, back);
      }
      if (req.method === "GET" && url.pathname === "/") {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.end("Fake GitHub (test only)\n");
      }
      if (req.method === "POST" && url.pathname === "/login/oauth/access_token") {
        const f = await readForm(req);
        // Like GitHub, OAuth errors come back as 200 with an error body.
        if (f.get("client_id") !== opts.clientId || f.get("client_secret") !== opts.clientSecret) {
          return json(res, 200, { error: "incorrect_client_credentials" });
        }
        const entry = codes.get(f.get("code") ?? "");
        if (!entry) return json(res, 200, { error: "bad_verification_code" });
        codes.delete(f.get("code") as string);
        if (sha256b64(f.get("code_verifier") ?? "") !== entry.challenge) {
          return json(res, 200, { error: "bad_verification_code", error_description: "PKCE verification failed" });
        }
        const token = `gho_fake_${randomBytes(12).toString("hex")}`;
        tokens.set(token, entry.user);
        last = token;
        return json(res, 200, { access_token: token, token_type: "bearer", scope: "" });
      }
      if (req.method === "GET" && url.pathname === "/user") {
        const m = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
        const user = m ? tokens.get(m[1] as string) : undefined;
        if (!user) return json(res, 401, { message: "Bad credentials" });
        return json(res, 200, user);
      }
      json(res, 404, { message: "Not Found" });
    })().catch(() => json(res, 500, { message: "fake failed" }));
  });
  await new Promise<void>((r) => server.listen(opts.port ?? 0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    setNextUser: (u) => {
      nextUser = u;
    },
    lastToken: () => last,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}
