# Account development and security boundaries

This guide is for the retained local account compatibility stack. The public website has no account API, sign-in or database. Staging authentication remains disabled. Authentication/provider acceptance is separate unfinished work; see the [staging record](../deployment/railway-staging.md) and [production runbook](../deployment/production.md). Run these commands from the repository root.

Local account exports must use a local `SITE_ORIGIN` so the public-origin build does not replace sign-in with its anonymous explanation. Pass the local origin explicitly when building the web image; no production configuration should be copied into this stack.

The optional account (Nostr sign-in and recovery codes) is a small Node 24 API in [`api/`](../../api/) with PostgreSQL. nginx serves the site and proxies `/api/` to it. The site starts and serves pages without the API.

```bash
cp api/.env.example api/.env.local   # fill in the recovery pepper; the GitHub App is optional
docker compose build --build-arg SITE_ORIGIN=http://localhost:8080 web
docker compose build api
docker compose up --no-build         # http://localhost:8080/sw/account/
```

- `api/.env.local` is git-ignored and is not sent to Docker builds. Secrets are never committed: compose reads them at run time.
- Open `http://localhost:8080`, not `127.0.0.1:8080`: the API checks each POST's origin against `SITE_ORIGIN` (`http://localhost:8080`) and refuses others with `bad_origin`.
- Only the site is published, on `127.0.0.1:8080`. The API and the database have no host port. This is a local development stack, not a production boundary.
- Sign in locally with Chromium or Firefox. The session cookie is `__Host-` and `Secure`, and Safari/WebKit refuses it on `http://localhost`.
- The rate limits live in the API's memory, so they reset whenever it restarts.
- GitHub is optional. With both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` unset the API starts without it: no `/api/auth/github/*` path exists and session cookies are `SameSite=Strict`. The sign-in page shows a GitHub button only when the site is built with `JIFUNZE_GITHUB_SIGNIN=1`; the default build, including the Docker web image, offers Nostr only. Setting only one of the two is a configuration error.
- If GitHub is configured, it requires the `redirect_uri` to match a registered callback. Register all three on the GitHub App: `/api/auth/github/callback`, `/api/auth/github/callback/reauth` and `/api/auth/github/callback/replace` (for example `http://localhost:8080/api/auth/github/callback`).

```bash
export TEST_DATABASE_URL=postgres://...   # a throwaway PostgreSQL database
npm run api:test
SITE_ORIGIN=http://localhost:4352 JIFUNZE_GITHUB_SIGNIN=1 npm run build   # the suites also cover the GitHub module
npm run e2e:account                      # Chromium, against the real API and a fake GitHub
```

`npm run e2e:account` starts a fake GitHub (`api/test/fake-github-server.ts`) with a test-only consent page. It is not real GitHub authentication. CI runs both, validates `compose.yaml` and builds the API image.

## Nostr account lifecycle

Stage 1 of the Nostr-first identity design (`docs/superpowers/specs/2026-11-12-nostr-first-identity-design.md`, proposed separately) adds these routes. Each proof is a NIP-98 event signed for that route's own URL, over a single-use challenge bound to the browser and, except for sign-in, to the session that asked for it.

| Route | Session | Effect |
| --- | --- | --- |
| `POST /api/auth/nostr/challenge` with `purpose` `signin`, `reauth` or `replace` | none for `signin`; full for `reauth`; full or recovery for `replace` | Issues the challenge and the URL to sign for |
| `POST /api/auth/nostr/reauth` | full | The account's own key confirms; refreshes this session's re-authentication time. Another key is refused (`nostr_key_mismatch`) and the challenge is spent |
| `POST /api/auth/nostr/replace` | recovery, or full re-authenticated within 10 minutes | Attaches the newly proven key to this session's account, revokes every session and starts a fresh one, and replaces the recovery codes. A key held by another account is refused (`identity_in_use`) and nothing changes |
| `POST /api/auth/logout/all` | any | Revokes every session of the account |
| `POST /api/me/delete` with `{"confirm":true}` | full, re-authenticated within 10 minutes | Deletes the account with its identities, sessions, challenges and recovery codes |

Key replacement rotates the recovery codes in the same transaction: every earlier code stops working and the response carries a fresh set once, in `codes`. A caller must show them to the learner; they cannot be read again. The account pages do not use these routes yet: the recovery and account screens for Nostr are Stage 4 of the design. No secret key, seed phrase or signer password is ever sent to the API.

## Server copy of progress

Stage 2 of the design adds a server copy of a learner's progress (`api/migrations/0002_progress.sql`, `api/src/progress.ts`). The site does not use it yet: synchronisation from the browser is Stage 3, so the device copy remains the only one a learner sees.

| Route | Session | Behaviour |
| --- | --- | --- |
| `GET /api/me/progress` | full | The account's progress as a version 1 document, the same format as the device copy and the export file |
| `POST /api/me/progress` | full | Merges a version 1 document (some or all lessons) into the account's copy and returns the merged whole |

- The account is always the session's. No path, query or body field can name another account, and a recovery session reaches neither route.
- `POST` only ever adds: earliest completion, earliest discussion confirmation, best quiz, union of lab passes. It applies the same rules as `mergeProgress` in `lib/progress/model.ts`, including the final tie-break (same ratio at the same instant: more questions wins), so a stale, repeated or reordered request cannot remove or change newer work. There is no way to un-complete a lesson through this API.
- Timestamps must be exactly what the site writes: UTC with milliseconds, for example `2026-11-12T08:15:30.123Z`. Any other form, an impossible date, or a time more than five minutes ahead of the server is refused with `400`. The device compares timestamps as text and the database as instants; the two only agree in this form.
- Limits: 64 KiB per request (this route only), 500 lessons per account, 100 lab passes per lesson, lab identifiers up to 64 characters, quizzes up to 1,000 questions, 60 merges and 120 reads per minute per account. A request that would exceed a per-account limit is rolled back whole.
- Deleting the account deletes its progress. Nothing is sent to a Nostr relay or any other service, and request logs carry the route only.

## Logs

Both nginx and the API log to the containers' stdout and stderr (`docker compose logs`).

- **What nginx keeps out:**
  - Access logs record the path only, never the query string. This includes requests nginx rejects itself, such as a 400.
  - Client addresses are truncated to /24 (IPv4) or /48 (IPv6).
  - No referrer is logged for `/api/`, and no `X-Forwarded-For`, cookies or bodies anywhere.
- **What the API keeps out:** it logs the method, route template, status and duration, and counts of recovery outcomes per hour. Never a body, cookie, query string, token or recovery code.
- **nginx error lines are the exception, and nginx cannot redact them.** They quote the full request line and the full client address (`client: …`).
  - They stay on, at the image's normal level, because they are what explains an outage.
  - No `/api/` URL carries a secret except the three GitHub callbacks, which hold the OAuth `code` and `state`. Those three alone log errors only at `crit` and above. Their failures still show in the access log (status, `upstream=`) and in `docker compose logs api`.
  - A malformed callback path, such as one containing a backslash, doesn't match those quiet locations in nginx, so its upstream errors are logged at the normal level, query string included. The API still treats it as a callback, with the same state and PKCE checks. Real codes and states only arrive at the exact registered callback URLs, so such a line can only hold values the requester typed.
- **Access:** anyone who can run `docker` on the host can read these logs. Keep that to operators. Never forward the logs to a shared tool that applies looser rules.
- **Retention policy:** account application logs require a 14-day retention limit (design F6). Compose bounds log size per container (the `local` driver, 3 × 10 MB) but cannot enforce an age limit. The host must enforce the 14 days, for example with journald `MaxRetentionSec=14day` or the log shipper's own retention; this is not a claim that the Compose stack enforces it.

`bash scripts/check-proxy.sh` checks all of this on a throwaway Docker stack: it sends callback requests carrying a code and state, stops the API mid-run, and greps every nginx and API log line.

## Authenticated production deployment gate: the HTTPS front proxy

This nginx listens on plain HTTP, so production needs a TLS terminator in front. **For deployments with an account API, do not deploy behind one until every item below is done.**

1. Uncomment the `set_real_ip_from` / `real_ip_header` / `real_ip_recursive` lines in [`docker/nginx.conf`](../../docker/nginx.conf).
   - Set `set_real_ip_from` to the front proxy's real address range. Never a guess, and never a wide private range other clients share.
   - Without this, every learner arrives from the proxy's address and shares one recovery and sign-in rate-limit bucket. One person's mistakes would then lock everyone out.
2. Make the front proxy append the client address to `X-Forwarded-For`, or overwrite the header.
   - `real_ip_recursive on` then takes the right-most untrusted address, so a learner's own forged `X-Forwarded-For` entries are ignored.
   - The API never reads `X-Forwarded-For`. It takes `X-Real-IP` only from a private peer (nginx), and nginx always overwrites `X-Real-IP` itself.
3. Make sure the front proxy's own access logs leave out query strings, at least for `/api/auth/github/callback*`. Otherwise it records the OAuth code and state that this nginx keeps out.
4. Re-run the checks against the real proxy. Send two requests from different networks and confirm they land in different buckets: after five wrong recovery codes from one network, the other still gets `401`, not `429`. Then confirm a forged `X-Forwarded-For` changes nothing.

`bash scripts/check-proxy.sh` already runs these checks against a stand-in front proxy, with realip on and off. That proves the nginx configuration. It does not prove the production proxy, whose header handling and logging are its own. The stand-in also speaks plain HTTP, so TLS itself is not exercised.
