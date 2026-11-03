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

export async function startFakeGithub(opts: { clientId: string; clientSecret: string }): Promise<FakeGithub> {
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
        const code = `code_${randomBytes(8).toString("hex")}`;
        codes.set(code, { challenge, user: nextUser });
        const back = new URL(redirect);
        back.searchParams.set("code", code);
        back.searchParams.set("state", url.searchParams.get("state") ?? "");
        res.statusCode = 302;
        res.setHeader("Location", back.toString());
        return res.end();
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
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
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
