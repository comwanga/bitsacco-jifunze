# Phase 3 Increment 2a: API foundation, GitHub sign-in, sessions and recovery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A learner can sign in with GitHub, receive ten recovery codes, sign out, and recover the account with a code, including replacing a lost GitHub identity. All of it in Kiswahili and English, with no change to anonymous learning pages.

**Architecture:**
- A new same-origin Node 24 + TypeScript API in `api/`: `node:http` plus a declarative route table, `postgres` and zod.
- PostgreSQL 16 holds accounts, identities, sessions, single-use challenges, recovery codes and security events.
- The static site gains account pages, which are data-free shells with client islands calling `/api`.
- nginx proxies `/api/`. The service worker never touches `/api/` or account pages, and evicts cached pages that now return 404 or 410.

**Tech stack:** Node 24 (type stripping), TypeScript 6.0.3, `postgres` 3.4.7, zod 4.6.7, Vitest 5.1.0, Next.js 16.4.4 static export, Playwright 1.64.1 with axe, nginx 1.30.6 (`nginx-unprivileged:stable-alpine`), PostgreSQL 16 (`postgres:16-alpine`).

**Spec:** [`docs/superpowers/specs/2026-11-04-phase-3-design.md`](../specs/2026-11-04-phase-3-design.md) (revision 3.2): sections E1, E3, E4, F1, F4, F5, F6, H1 (row 2a) and H3.

## Global Constraints

- **Out of scope for 2a:** Nostr (2b and 2c), linking a *second* provider, account deletion and export, preference editing (2d), profiles and community (3), GitHub contribution sync (4), the dashboard (5), and the navigation restructure to Paths · Labs · Builders · Resources (it arrives with Increment 3, when Builders exists).
- **GitHub:** the App requests **no permissions**. User tokens are used once for `GET /user` and then discarded. A token is never stored, logged or returned. PKCE uses `S256` only, and `state` is single-use.
- **Installation token:** the check (design G4) stays **unresolved**. Nothing in 2a depends on it.
- **Cookies:**
  - Session: `__Host-jf_session` (HttpOnly; Secure; SameSite=Lax; Path=/).
  - Pre-auth: `__Host-jf_preauth` (HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600).
  - Nothing else is set; there is no `jf_signed_in` cookie.
- **Session lifetimes:** full sessions have a 14-day idle and 30-day absolute expiry; recovery sessions last 15 minutes. Re-authentication is valid for 10 minutes, and a GitHub challenge expires after 10 minutes.
- **Session storage:** the token is 32 random bytes held only in the cookie. The database stores `sha256(token)`.
- **Recovery codes:**
  - Ten codes, each 16 base32 characters (alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`, 80 bits), shown as `XXXX-XXXX-XXXX-XXXX`.
  - Stored as `HMAC-SHA256(pepper_vN, normalised)` with a `pepper_version`; `code_hash` is globally unique.
  - `POST /api/auth/recovery` takes `{ code }` only.
- **Rate limits** (in memory; a restart resets them, which is documented):
  - recovery: 5 per 15 minutes per IP, 20 per hour per /24, 300 per hour globally;
  - `GET /api/auth/github/start`: 30 per 10 minutes per IP.
- **Every `/api` response** carries `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer` and `Vary: Cookie`.
- **Every non-GET request** needs `Origin` equal to `SITE_ORIGIN` exactly, plus `X-Jifunze: 1`. Bodies are JSON only, at most 16 KB.
- **Errors** look like `{ "error": { "code", "message_sw", "message_en" } }`.
- **The session decides the account.** A request parameter never names the account to act on.
- **Logging:** method, route template, status, latency and the account id (if any) only. Never bodies, tokens, cookies, codes or full IP addresses.
- **Learning pages:** their JS budgets are unchanged, and `npm run check:ux-budget` must pass with the same maxima. The account pages' JS is measured and reported.
- **Copy:** every new string exists in Kiswahili and English in route-local copy modules, with parity tests. Nothing goes in `lib/i18n.ts`. New terms are listed as **pending review** in `content/terminology-review.json`.
- **Commits:** signed, with no co-author trailers. Secrets never go in the repo, chat, screenshots or logs.

## Review Focus

1. **`__Host-` cookies on `http://localhost`** (development and CI) versus HTTPS in production. Chromium and Firefox accept Secure cookies on localhost, Safari does not. The account e2e asserts that the cookie is set in Chromium (Task 9). The README states that local sign-in needs Chromium or Firefox.
2. **A GitHub login renamed between sign-ins.** The identity matches on the numeric id, and `handle` is refreshed (Task 4 test).
3. **Consent denied or the tab abandoned** (`error=access_denied`, or a missing or expired `state`). The bilingual error shows on the sign-in page, no account is created, and the challenge expires (Task 4 test).
4. **Two tabs start sign-in.** The second start replaces the pre-auth cookie, so the first tab's callback fails with `state_invalid` and its retry succeeds. An API restart between start and callback still completes, because the flow state is in Postgres (Task 4 tests).
5. **Service-worker versions during rollout.** Clients may still be controlled by the old worker. Account pages hold no private data, and the old worker's navigation handler never caches `/api` redirects (opaque redirects aren't `ok`). The new worker's explicit `/api/` bypass is unit-tested (Task 8).

## File structure

```
api/
  package.json, package-lock.json   runtime deps only: postgres 3.4.7, zod 4.6.7 (tooling from the root)
  vitest.config.ts                  API unit and integration tests (sequential; real Postgres)
  migrations/0001_accounts.sql      accounts, identities, sessions, auth_challenges, recovery_codes, security_events
  src/main.ts                       entry: load config, migrate, start the server and the daily purge
  src/config.ts                     zod-validated environment
  src/http.ts                       server, route matching, the request pipeline, replies and cookies
  src/errors.ts                     ApiError and the bilingual messages for each code
  src/db.ts                         postgres client and the migration runner
  src/sessions.ts                   create, read, revoke, re-auth, purge
  src/challenges.ts                 create and atomic consume of the single-use flow state
  src/github.ts                     authorize URL, code exchange, /user (fetch injectable)
  src/accounts.ts                   find-or-create by identity, identity replacement, security events
  src/recovery.ts                   generate, normalise, HMAC, issue and consume codes
  src/ratelimit.ts                  in-memory fixed-window limiter
  src/routes.ts                     the 2a route table
  test/helpers.ts                   test DB reset, request helper, cookie jar
  test/fake-github.ts               a fake GitHub OAuth server and /user (for tests and the account e2e)
  test/*.test.ts                    one file per area (named in each task)
docker/api.Dockerfile               API image (node:24-bookworm-slim, npm ci --omit=dev in api/)
docker/nginx.conf                   + /api/ proxy, /api/internal/ blocked
compose.yaml                        local stack: web, api, db (no secrets; reads api/.env.local)
api/.env.example                    variable names only
lib/account-copy.ts                 sw/en copy for account pages and API error codes (route-local)
lib/site-copy.ts                    + account: "Akaunti" / "Account"
content/terminology-review.json     terms pending Kiswahili review
app/[lang]/account/{page,signin/page,welcome/page,recovery/page,signout/page}.tsx
components/account/*.tsx            client islands: AccountHome, SignIn, Welcome, Recovery, SignOut
components/layout/{SiteHeader,HeaderNav}.tsx   + the Account link
public/sw.js                        /api/ bypass, private navigations network-only, evict on 404/410
scripts/postbuild.ts                link checker ignores /api/ hrefs
scripts/serve-out.mjs               optional /api proxy (API_PROXY env) for the account e2e
playwright.account.config.ts, e2e-account/*.spec.ts   the account e2e (fake GitHub, API, Postgres)
.github/workflows/ci.yml            + account job (Postgres service)
tests/pwa/sw.test.ts, tests/i18n/account-copy.test.ts, tests/build/postbuild.test.ts
```

---

### Task 1: API skeleton: configuration, routing, errors and response rules

**Files:**
- Create: `api/package.json`, `api/vitest.config.ts`, `api/src/{config,http,errors,routes,main}.ts`, `api/test/helpers.ts`, `api/test/http.test.ts`
- Modify: `package.json` (scripts `api:test` → `vitest run --config api/vitest.config.ts`, and `api:start` → `node api/src/main.ts`); `.gitignore` (`api/.env.local`, `api/node_modules/`)

**Interfaces:**

Produces:

```ts
// config.ts
export type Config = { siteOrigin: string; port: number; databaseUrl: string; githubClientId: string; githubClientSecret: string;
  githubOAuthBase: string; githubApiBase: string; peppers: Map<number, Buffer>; currentPepper: number };
export function loadConfig(env: NodeJS.ProcessEnv): Config;
// Reads SITE_ORIGIN, PORT=3001, DATABASE_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
// GITHUB_OAUTH_BASE=https://github.com, GITHUB_API_BASE=https://api.github.com,
// RECOVERY_PEPPER_V1 (base64, ≥32 bytes); more versions as RECOVERY_PEPPER_V2…
// Errors name the missing keys only, never their values.

// errors.ts
export type ErrorCode = "not_found" | "method_not_allowed" | "bad_origin" | "bad_request" | "payload_too_large" | "unauthenticated"
  | "recovery_scope" | "reauth_required" | "recovery_invalid" | "rate_limited" | "state_invalid" | "github_denied" | "github_failed"
  | "identity_in_use" | "replace_conflict" | "codes_already_issued" | "internal";
export class ApiError extends Error { constructor(readonly status: number, readonly code: ErrorCode) }
export const MESSAGES: Record<ErrorCode, { sw: string; en: string }>;

// http.ts
export type Session = { tokenHash: Buffer; accountId: string; scope: "full" | "recovery"; reauthAt: Date };
export type ReadSession = (sql: Sql, cookieValue: string | undefined) => Promise<Session | null>;
export type Auth = "public" | "full" | "any";   // "any" = a full or recovery session
export type Route = { method: "GET" | "POST"; path: string; auth: Auth; recoveryAllowed?: boolean;
  body?: import("zod").ZodType; handler: (ctx: Ctx) => Promise<Reply> };
export type Ctx = { params: Record<string, string>; query: URLSearchParams; body: unknown; cookies: Record<string, string>;
  ip: string; session: Session | null; cfg: Config; sql: Sql };
export type Reply = { status: number; json?: unknown; redirect?: string; setCookies?: string[] };
export function createServer(routes: Route[], deps: { cfg: Config; sql: Sql; readSession: ReadSession }): import("node:http").Server;
```

- [ ] **Step 1: Write the failing tests** in `api/test/http.test.ts`, against a server started on port 0 with a stub route table:
  - `unknown path → 404 not_found`, and the JSON has `error.code`, `message_sw` and `message_en`;
  - `wrong method → 405 method_not_allowed`;
  - `every response has no-store, noindex, no-referrer and Vary: Cookie`, including 404, 405 and 500;
  - `POST without Origin, wrong Origin, or without X-Jifunze → 403 bad_origin`;
  - `POST with a non-JSON content type → 400 bad_request`;
  - `a body over 16 KB → 413 payload_too_large` (the stream is not read further);
  - `a zod-invalid body → 400 bad_request`;
  - `a route with auth "full" and no session → 401 unauthenticated`;
  - `a handler throw → 500 internal`, with no stack trace in the body;
  - `the client IP comes from X-Real-IP only when the socket is loopback or private; otherwise from the socket`;
  - `GET /api/health → 200 {"ok":true}`;
  - `loadConfig with keys missing throws listing those keys and no values`.
- [ ] **Step 2: Run** `npm run api:test -- http`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `config.ts`, `errors.ts` (the bilingual messages for every `ErrorCode`), `http.ts` and the `health` route.
  - Route matching works on `/api/...` paths with `:param` segments.
  - The pipeline runs in this order: headers → match → origin check (non-GET) → size and content-type → zod → session → handler.
  - A request log line records the route template only.
- [ ] **Step 4: Run** `npm run api:test -- http`. Expected: PASS. Then `npm run lint && npm run typecheck`. Expected: clean.
- [ ] **Step 5: Commit** `feat(api): request pipeline with origin, size and response-header rules`.

### Task 2: Database and migrations

**Files:**
- Create: `api/migrations/0001_accounts.sql`, `api/src/db.ts`, `api/test/db.test.ts`
- Modify: `api/test/helpers.ts`

**Interfaces:**
- Produces `export function connect(url: string): Sql`.
- Produces `export async function migrate(sql: Sql, dir: string): Promise<string[]>`, which returns the newly applied file names.
- Produces `export async function resetTestDb(sql: Sql): Promise<void>` (helpers).
- Tables are as in design E3. `accounts` adds `recovery_codes_issued_at timestamptz`, and `sessions` adds `scope text not null check (scope in ('full','recovery'))`.

- [ ] **Step 1: Write the failing tests** `api/test/db.test.ts` (with `TEST_DATABASE_URL`):
  - `migrate applies 0001 once and records it in schema_migrations; a second run applies nothing`;
  - `identities enforce unique (provider, provider_uid) and unique (account_id, provider)`;
  - `deleting an account cascades identities, sessions, challenges and recovery codes`;
  - `security_events keep rows with account_id null after deletion`.
- [ ] **Step 2: Run** `npm run api:test -- db`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - The migration SQL exactly as design E3, limited to the 2a tables plus the two columns above.
  - `migrate`: each file applied in its own transaction, in filename order, under `pg_advisory_xact_lock`.
- [ ] **Step 4: Run** `npm run api:test -- db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): PostgreSQL schema for accounts, sessions and recovery`.

### Task 3: Sessions, `/api/me`, logout and the daily purge

**Files:**
- Create: `api/src/sessions.ts`, `api/test/sessions.test.ts`
- Modify: `api/src/routes.ts`, `api/src/main.ts`

**Interfaces:**

Consumes `connect`, `ApiError` and `Route`. Produces:

```ts
// Session and ReadSession come from http.ts (Task 1); readSession below satisfies ReadSession.
export async function createSession(sql: Sql, accountId: string, scope: Session["scope"]): Promise<{ cookie: string; tokenHash: Buffer }>;
export async function readSession(sql: Sql, cookieValue: string | undefined): Promise<Session | null>; // updates last_seen_at
export async function revokeSession(sql: Sql, tokenHash: Buffer): Promise<void>;
export async function revokeOtherSessions(sql: Sql, accountId: string, keep?: Buffer): Promise<number>;
export async function markReauth(sql: Sql, tokenHash: Buffer): Promise<void>;
export async function purgeExpired(sql: Sql): Promise<{ sessions: number; challenges: number; events: number }>;
export const clearSessionCookie: string;
```

Routes:
- `GET /api/me` (auth `any`, `recoveryAllowed`) → `{ scope, account: { id, preferredLang, recoveryCodesIssued }, identities: [{ provider, handle, avatarUrl, linkedAt }], notices: [{ type: "recovery_code_used", at }] }`
- `POST /api/auth/logout` (auth `any`, `recoveryAllowed`) → 204 and a cleared cookie.

All times come from the database's `now()`, never the app clock.

- [ ] **Step 1: Write the failing tests** `api/test/sessions.test.ts`:
  - `cookie flags are exactly __Host-jf_session; HttpOnly; Secure; SameSite=Lax; Path=/`;
  - `the stored row has sha256(token), not the token`;
  - `idle 14 days → null`, `absolute 30 days → null` and `recovery scope after 15 minutes → null`, each by moving `last_seen_at`, `created_at` or `expires_at` in SQL;
  - `a revoked session → 401 on /api/me`;
  - `logout clears the cookie and revokes the row`;
  - `a recovery session gets 403 recovery_scope on a route without recoveryAllowed`;
  - `/api/me never contains a token, cookie or code`;
  - `purgeExpired removes expired sessions, challenges and security events older than 90 days, and keeps the rest`.
- [ ] **Step 2: Run** `npm run api:test -- sessions`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - `sessions.ts` and the two routes.
  - In `main.ts`: `purgeExpired` once at boot and then every 24 hours (an `unref()`'d interval).
- [ ] **Step 4: Run** `npm run api:test -- sessions`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): server-side sessions with full and recovery scopes`.

### Task 4: GitHub sign-in (start and callback)

**Files:**
- Create: `api/src/{challenges,github,accounts,ratelimit}.ts`, `api/test/fake-github.ts`, `api/test/github-signin.test.ts`
- Modify: `api/src/routes.ts`

**Interfaces:**

Consumes `createSession`, `markReauth` and `revokeOtherSessions`. Produces:

```ts
// challenges.ts
export async function createChallenge(sql: Sql, c: { purpose: "signin" | "reauth" | "replace"; provider: "github";
  accountId?: string; lang: "sw" | "en"; returnTo: string; pkceVerifier: string }): Promise<{ secret: string; preauth: string }>;
export async function consumeChallenge(sql: Sql, c: { secret: string; preauth: string; provider: "github" }):
  Promise<{ purpose: string; accountId: string | null; lang: "sw" | "en"; returnTo: string; pkceVerifier: string } | null>;
  // one UPDATE … WHERE secret_hash AND binding_hash AND used_at IS NULL AND expires_at > now() RETURNING
export function safeReturn(path: string | null, lang: "sw" | "en"): string; // ^/(sw|en)/[a-z0-9/_-]*$, else /{lang}/account/

// github.ts (fetchFn injectable; the token never leaves this module's call frame)
export function authorizeUrl(cfg: Config, a: { state: string; codeChallenge: string; redirectUri: string }): string;
export async function githubIdentity(cfg: Config, a: { code: string; codeVerifier: string; redirectUri: string },
  fetchFn?: typeof fetch): Promise<{ id: number; login: string; avatarUrl: string }>;

// ratelimit.ts (in memory, fixed windows; a restart resets the counts)
export class Limiter {
  constructor(rules: { name: string; key: (ip: string) => string; limit: number; windowMs: number }[]);
  hit(ip: string): boolean;        // false = over a limit; checked before any lookup
}
export const slash24: (ip: string) => string;   // "203.0.113.0/24"; IPv6 → its /48

// accounts.ts
export async function findOrCreateByGithub(sql: Sql, gh: { id: number; login: string; avatarUrl: string }, lang: "sw" | "en"):
  Promise<{ accountId: string; created: boolean }>;
export async function logEvent(sql: Sql, accountId: string | null, event: string, detail?: Record<string, string>): Promise<void>;
```

Routes:
- `GET /api/auth/github/start?purpose=signin&lang&return` (public, 30 per 10 minutes per IP) → 302 to `{GITHUB_OAUTH_BASE}/login/oauth/authorize` with `client_id`, `redirect_uri={SITE_ORIGIN}/api/auth/github/callback`, `state`, `code_challenge`, `code_challenge_method=S256`; and `Set-Cookie: __Host-jf_preauth`.
- `GET /api/auth/github/callback?code&state` or `?error&state` (public):
  - consume the challenge;
  - exchange the code with `code_verifier`;
  - call `GET /user`;
  - find or create the account by numeric id, refreshing `handle` and `avatar_url`;
  - **rotate**: always a new session;
  - log the event;
  - clear the pre-auth cookie;
  - 302 to `/{lang}/account/welcome/` for a new account, otherwise to `returnTo`.
- On any failure, 302 to `/{lang}/account/signin/?error={code}`.

`fake-github.ts` is a `node:http` server:
- `/login/oauth/authorize` → 302 back with a code for the next configured user.
- `/login/oauth/access_token` → checks `client_id`, `client_secret`, `code` and `sha256(code_verifier)` against the challenge, then returns a token.
- `/user` → returns the configured user, with bearer token checking.

- [ ] **Step 1: Write the failing tests** `api/test/github-signin.test.ts`, with the fake on port 0 and `GITHUB_*_BASE` pointing at it:
  - `start returns 302 with S256 challenge and sets __Host-jf_preauth (HttpOnly, Secure, SameSite=Lax, Max-Age=600)`;
  - `callback creates an account and a session, and redirects to /sw/account/welcome/ when lang=sw`;
  - `a second sign-in with the same GitHub id reuses the account and refreshes a renamed login` (Review Focus 2);
  - `state reused → state_invalid`;
  - `state with the wrong pre-auth cookie → state_invalid`;
  - `expired state → state_invalid`;
  - `PKCE verifier mismatch (fake rejects) → github_failed, no account`;
  - `error=access_denied → github_denied, no account, challenge left to expire` (Review Focus 3);
  - `return=https://evil.example or //evil or /sw/../x → falls back to /sw/account/`;
  - `two starts in one browser: the first callback → state_invalid, the second → success` (Review Focus 4);
  - `callback succeeds after the API is restarted between start and callback` (a new server instance, same DB);
  - `no column, log line or response contains the access token` (scan the DB dump and captured logs for the fake's token value);
  - `start is rate limited at the 31st request in 10 minutes from one IP`.
- [ ] **Step 2: Run** `npm run api:test -- github-signin`. Expected: FAIL.
- [ ] **Step 3: Implement** `challenges.ts`, `github.ts`, `accounts.ts`, `ratelimit.ts` (its `Limiter` is also used in Task 5) and the two routes, as specified.
- [ ] **Step 4: Run** `npm run api:test -- github-signin`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): GitHub sign-in with PKCE and single-use state`.

### Task 5: Recovery codes and recovery sessions

**Files:**
- Create: `api/src/recovery.ts`, `api/test/recovery.test.ts`
- Modify: `api/src/routes.ts`, `api/src/ratelimit.ts`

**Interfaces:**

Consumes `createSession`, `revokeOtherSessions`, `Limiter` and `logEvent`. Produces:

```ts
export function generateCodes(): string[];                      // 10 × "XXXX-XXXX-XXXX-XXXX", crypto.randomBytes
export function normaliseCode(input: unknown): string | null;   // upper-case, strip "-" and spaces, 16 chars of the alphabet
export function hashCode(pepper: Buffer, normalised: string): Buffer; // HMAC-SHA256
export async function issueCodes(sql: Sql, cfg: Config, accountId: string): Promise<string[]>; // replaces the whole set
export async function consumeCode(sql: Sql, cfg: Config, normalised: string): Promise<string | null>; // accountId; atomic
```

Routes:
- `POST /api/me/recovery-codes/initial` (full; only while `recovery_codes_issued_at` is null) → `{ codes }`. Otherwise 409 `codes_already_issued`.
- `POST /api/me/recovery-codes` (full with re-auth ≤ 10 minutes, or recovery scope) → `{ codes }`. Otherwise 403 `reauth_required`.
- `POST /api/auth/recovery` (public; body `{ code: string }` only):
  1. Apply the limits first: 5 per 15 minutes per IP, 20 per hour per /24, 300 per hour globally → 429 `rate_limited`.
  2. Then normalise, look up by HMAC (every pepper version), and consume atomically.
  3. On success: revoke **all** of the account's sessions, create a `recovery` session, log the event, and return 200 `{ redirect: "/{lang}/account/recovery/" }`.
  4. Every failure returns `401 recovery_invalid` with the same body.

- [ ] **Step 1: Write the failing tests** `api/test/recovery.test.ts`:
  - `generateCodes gives 10 distinct codes in groups of four from the base32 alphabet`;
  - `the database stores no plaintext code`;
  - `initial codes come back once; the second call → 409`;
  - `a code works once; the second use → 401 recovery_invalid`;
  - `20 concurrent uses of one code → exactly one 200`;
  - `regenerating invalidates every old code`;
  - `unknown, used, malformed and empty input all give an identical 401 body`;
  - `the body accepts no handle or account id` (extra keys → 400 bad_request, with no hint);
  - `the 6th attempt from one IP in 15 minutes → 429`;
  - `the 21st from one /24 in an hour → 429`;
  - `the 301st globally → 429`;
  - `a recovery session revokes the account's other sessions`;
  - `a recovery session expires at 15 minutes`;
  - `/api/me shows a recovery_code_used notice afterwards`;
  - `security_events contain no code`;
  - `a code hashed with pepper v1 still works after v2 becomes current`.
- [ ] **Step 2: Run** `npm run api:test -- recovery`. Expected: FAIL.
- [ ] **Step 3: Implement** `recovery.ts`, the limiter keys (`ip`, `/24`, `global`) and the three routes.
- [ ] **Step 4: Run** `npm run api:test -- recovery`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): single-use recovery codes and restricted recovery sessions`.

### Task 6: Re-authentication and GitHub identity replacement

**Files:**
- Create: `api/test/replace.test.ts`
- Modify: `api/src/{routes,accounts,challenges}.ts`

**Interfaces:**

Consumes the challenge, session and GitHub functions from Tasks 3–4. Produces:

```ts
export async function replaceGithubIdentity(sql: Sql, accountId: string, gh: { id: number; login: string; avatarUrl: string }):
  Promise<"replaced" | "unchanged">;
// One transaction: SELECT … FROM accounts WHERE id = $1 FOR UPDATE; refuse if (github, gh.id) belongs to another account
// (ApiError 409 identity_in_use); delete this account's github identity; insert the new one; revoke the old identity's sessions;
// logEvent. If gh.id equals the current identity → "unchanged".
```

`GET /api/auth/github/start` accepts `purpose`:
- `reauth` (full session) → the callback runs `markReauth`.
- `replace` (a recovery session, or a full session with re-auth ≤ 10 minutes) → the callback runs `replaceGithubIdentity` for the challenge's `accountId`, and **requires that challenge's session to still be valid**.

A `replace` or `reauth` challenge is never accepted as `signin`, and the reverse holds too.

- [ ] **Step 1: Write the failing tests** `api/test/replace.test.ts`:
  - `a recovery session replaces GitHub A with GitHub B; B signs in to the same account; A no longer reaches it` (a sign-in with A now creates a separate new account, as for any unlinked identity);
  - `every route in the final 2a table with auth other than "public" rejects a request without a session with 401, and every route without recoveryAllowed rejects a recovery session with 403` (enumerates `routes.ts`, so a later route can't skip its check);
  - `replacing with the same GitHub id → unchanged, success`;
  - `replacing with a GitHub id linked to another account → 409 identity_in_use, both accounts unchanged`;
  - `two concurrent replacements on one account → exactly one commits; the other → 409 replace_conflict`;
  - `two accounts racing to take the same new GitHub id → one wins; the loser → 409 identity_in_use, unchanged`;
  - `a replace callback after the recovery session expired → 401 unauthenticated, nothing changed`;
  - `a replace challenge used for signin → state_invalid`, and the reverse;
  - `a full session without recent re-auth cannot start replace → 403 reauth_required`;
  - `reauth sets reauth_at, and regenerating codes then succeeds within 10 minutes and fails after`.
- [ ] **Step 2: Run** `npm run api:test -- replace`. Expected: FAIL.
- [ ] **Step 3: Implement** `replaceGithubIdentity` and the purpose handling. `replace_conflict` is raised when the row lock waits beyond `lock_timeout = '2s'`, or when the identity changed between the challenge and the commit.
- [ ] **Step 4: Run** `npm run api:test`. Expected: every API test passes.
- [ ] **Step 5: Commit** `feat(api): re-authentication and atomic GitHub identity replacement`.

### Task 7: Account pages, the header link and bilingual copy

**Files:**
- Create: `lib/account-copy.ts`, `tests/i18n/account-copy.test.ts`, `content/terminology-review.json`, `app/[lang]/account/{page,signin/page,welcome/page,recovery/page,signout/page}.tsx`, `components/account/{AccountHome,SignIn,Welcome,Recovery,SignOut,api}.tsx`
- Modify: `lib/site-copy.ts` (add `account`), `components/layout/{SiteHeader,HeaderNav}.tsx`, `lib/build/links.ts` (`internalRefs` skips refs starting with `/api/`, which are served by the API, not `out/`), `tests/build/postbuild.test.ts`

**Interfaces:**
- `accountCopy: Record<Lang, AccountCopy>`, the same typed-parity pattern as `simulationCopy`. It includes a message for every API `ErrorCode`.
- Each page is a static shell with `robots: { index: false }` metadata and one client island.
- Islands fetch through `components/account/api.ts`: `apiFetch(path, init)` adds `X-Jifunze: 1` and `credentials: "same-origin"`, and parses the error shape.

Pages:
- `signin/`: a "Endelea na GitHub / Continue with GitHub" link to `/api/auth/github/start?purpose=signin&lang={lang}&return={safe}`, a `<details>` "Tumia msimbo wa kurejesha / Use a recovery code" form, and `?error=` shown as a localized alert.
- `welcome/`: the codes, shown once, in a monospace list; "Nakili / Copy" and "Pakua (.txt) / Download (.txt)" buttons; a required "Nimezihifadhi / I've saved them" checkbox before "Endelea".
- `account/` (home): signed-in identity, the recovery notice, "Tengeneza misimbo mipya / New recovery codes" (via re-auth) and "Toka / Sign out". Signed out, it shows the sign-in prompt.
- `recovery/`: a "Badilisha GitHub / Replace GitHub" link (`purpose=replace`), new codes, and sign out.
- `signout/`: POST logout, then a signed-out message.
- **Header:** an "Akaunti / Account" link to `/{lang}/account/`, using the existing `NavLink` (so `aria-current` covers `/{lang}/account/`). On desktop it sits after the divider, before the language switch; on phones it is the last item in the menu.

- [ ] **Step 1: Write the failing tests:**
  - `tests/i18n/account-copy.test.ts`: parity of keys; non-empty values; every `ErrorCode` from `api/src/errors.ts` has `sw` and `en` copy.
  - `tests/build/postbuild.test.ts`: `internalRefs` returns no `/api/...` refs, while still returning `/sw/x/`, so a missing page is still reported.
  - E2E specs are written in Task 9.
- [ ] **Step 2: Run** `npx vitest run tests/i18n/account-copy.test.ts tests/build/postbuild.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - the copy (Kiswahili and English written independently, not machine-translated);
  - the pages and islands;
  - the header link;
  - the link-checker exception;
  - `content/terminology-review.json`: `[{ term_en, term_sw, status: "pending", context }]` for *sign in, sign out, account, session, recovery code, identity, replace, re-authenticate*.
- [ ] **Step 4: Run** `npm run check && npm run build && npm run check:ux-budget`. Expected:
  - the check passes;
  - the build passes, including links and CSP;
  - the UX budget maxima are **unchanged** (home 143.43, roadmap and tree 143.63, catalogue 142.32, simulation 141.78, lesson 146.02, lab 151.94 KB). Report any difference and stop if a budget rises.
  - Record the account pages' JS sizes.
  - `npx playwright test e2e/header.spec.ts e2e/header-footer.spec.ts` still passes. The desktop Account link sits **outside** the `<nav aria-label="Menu">` list, so the five-link assertion holds. The 360 px spare-width test still passes, because Account is inside the phone menu.
- [ ] **Step 5: Commit** `feat(account): bilingual sign-in, welcome, recovery and account pages`.

### Task 8: Service-worker protections

**Files:**
- Modify: `public/sw.js`, `tests/pwa/sw.test.ts`

**Interfaces:**
- Produces, in `sw.js`, `privateNavigation(pathname)`, which is true for `^/(sw|en)/(account|community)(/|$)`.
- Fetch handler order:
  1. `/api/` → return (the browser handles it);
  2. `/_next/static/` → cache-first;
  3. a navigation where `privateNavigation` holds → network-only; on network failure, the cached offline page;
  4. other navigations → network-first;
  5. data files;
  6. the static allowlist.
- `networkFirstPage` runs `cache.delete(stripSearch(request))` when the response status is 404 or 410.

- [ ] **Step 1: Write the failing tests** (`tests/pwa/sw.test.ts`, using the existing fake-`self` pattern):
  - `a navigation to /api/auth/github/start is not intercepted` (no `respondWith`);
  - `a navigation to /sw/account/ is answered from the network and never put in any cache`;
  - `/en/community/x/ behaves the same`;
  - `a cached /en/glossary/ is deleted when the network returns 404`, and the same for 410;
  - `a 200 navigation is still cached as before`;
  - `privateNavigation` is true for `/sw/account`, `/sw/account/`, `/en/community/a/` and false for `/sw/accounts/`, `/sw/learn/`.
- [ ] **Step 2: Run** `npx vitest run tests/pwa/sw.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the handler order and the eviction.
- [ ] **Step 4: Run** `npx vitest run tests/pwa/sw.test.ts`, then `npm run build && npm run e2e`. Expected: PASS. The existing offline tests (`housekeeping`, `practice`, `smoke`) still pass.
- [ ] **Step 5: Commit** `fix(pwa): never cache account pages or the API, and drop pages that now return 404`.

### Task 9: Stack integration, account e2e and CI

**Files:**
- Create: `docker/api.Dockerfile`, `compose.yaml`, `api/.env.example`, `playwright.account.config.ts`, `e2e-account/{signin,recovery,a11y}.spec.ts`
- Modify: `docker/nginx.conf`, `scripts/serve-out.mjs`, `.github/workflows/ci.yml`, `README.md`, `package.json` (script `e2e:account`)

**Interfaces:**
- **nginx:**

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;           # Docker DNS; the learning site still starts without an API
location /api/internal/ { return 404; }
location /api/ {
  set $api http://api:3001;
  proxy_pass $api;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header Host $host;
  include /etc/nginx/snippets/security-headers.conf;
}
```

- **`serve-out.mjs`:** when `API_PROXY` is set, it streams `/api/*` there, with `X-Real-IP: 127.0.0.1`.
- **`playwright.account.config.ts`** runs three web servers:
  1. the fake GitHub on 4350;
  2. the API on 4351, with `TEST_DATABASE_URL`, `SITE_ORIGIN=http://localhost:4352` and `GITHUB_*_BASE=http://localhost:4350`;
  3. `serve-out.mjs` on 4352 with `API_PROXY`.
- **The CI job `account`:**
  - service `postgres:16-alpine`;
  - `npm ci` and `npm ci --prefix api`;
  - `npm audit --omit=dev --prefix api --audit-level=low`;
  - `npm run api:test`;
  - `npm run build`;
  - `npx playwright install --with-deps chromium`;
  - `npm run e2e:account`;
  - `docker compose config -q`;
  - `docker build -f docker/api.Dockerfile .`

- [ ] **Step 1: Write the failing tests** (`e2e-account/`):
  - **`signin.spec.ts`, in sw and en:**
    - Continue with GitHub → the fake consents → `/{lang}/account/welcome/` lists 10 codes;
    - the checkbox gates Continue;
    - account home shows the GitHub login;
    - the `__Host-jf_session` cookie is set with HttpOnly and Secure (Review Focus 1);
    - Sign out returns to the signed-out state;
    - a denied consent shows the localized `github_denied` message;
    - the language survives the round trip (`lang=sw` in, `/sw/...` out).
  - **`recovery.spec.ts`:**
    - use a code from welcome → `/{lang}/account/recovery/`;
    - Replace GitHub with a second fake user → signing in with the old fake user creates a *new* account; the new one reaches the original account;
    - a reused code shows `recovery_invalid`.
  - **`a11y.spec.ts`:** axe (WCAG 2.1 AA, no serious or critical findings) on signin, welcome, account, recovery and signout, in both languages and at 360 px.
  - **Service worker (in `signin.spec.ts`):** after signing in and browsing, `caches` holds no `/api` response and no `/account/` page.
  - **Budget guard (in `signin.spec.ts`):** an anonymous visit to `/sw/` makes **no** `/api` request.
- [ ] **Step 2: Run** `npm run build && npm run e2e:account`. Expected: FAIL until the wiring exists.
- [ ] **Step 3: Implement** the nginx change, the proxy option, the configs, the Dockerfile, the compose file, the CI job, and a README section "Akaunti (account) stack" covering: local `docker compose up` and `api/.env.local` (git-ignored); secrets never committed; local sign-in needs Chromium or Firefox; the in-memory rate limits reset on restart.
- [ ] **Step 4: Run** `npm run check && npm run api:test && npm run build && npm run check:ux-budget && npm run e2e && npm run e2e:account && docker compose config -q`. Expected: all pass, with the existing e2e counts unchanged (148 passed in CI terms) plus the new account specs.
- [ ] **Step 5: Commit** `feat(stack): nginx /api proxy, local compose and account e2e in CI`.

### Task 10: Verification with the test GitHub App (maintainer credentials, out of repo)

**Files:**
- Create: none.
- Modify: `README.md` (how to run against a real test App: credentials in `api/.env.local` or the environment, never committed).

- [ ] **Step 1:** With the maintainer-provided **test** App (no permissions, personal account) configured outside the repo, run `docker compose up`. Sign in at `http://localhost:8080/sw/account/signin/` in Chromium, complete welcome, sign out, then sign in again. Expected: works in both languages, and the GitHub consent screen requests **no** permissions.
- [ ] **Step 2:** Confirm that the database holds no GitHub token (`select` on every table, scanning for the `ghu_`/`gho_` prefixes), and that the API logs contain no token, cookie or code. Expected: none found.
- [ ] **Step 3:** In the PR, record the results and the H3 release-gate checklist:
  - the security boundaries tested;
  - pending terminology;
  - the measured JS on learning pages (expected: unchanged);
  - G4 **still unresolved** (not part of 2a).

  Commit only README changes, if any: `docs: running the account stack against a test GitHub App`.
