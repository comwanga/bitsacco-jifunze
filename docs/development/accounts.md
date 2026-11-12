# Account development and security boundaries

> **Retired from the site on 2026-11-12.** Jifunze is account-free: it has no account pages, sign-in or account link, and never calls this API. The API in `api/`, its image, the Compose services and the proxy rules are kept unused until a separate cleanup decision; see the [decision record](../audit/2026-11-12-account-free-learning.md). The rest of this page describes that retained stack, not anything a learner can reach.

This guide is for the retained local account compatibility stack. The public website has no account API, sign-in or database. Staging authentication remains disabled. Authentication/provider acceptance is separate unfinished work; see the [staging record](../deployment/railway-staging.md) and [production runbook](../deployment/production.md). Run these commands from the repository root.

Local account exports must use a local `SITE_ORIGIN` so the public-origin build does not replace sign-in with its anonymous explanation. Pass the local origin explicitly when building the web image; no production configuration should be copied into this stack.

The optional account (GitHub sign-in and recovery codes) is a small Node 24 API in [`api/`](../../api/) with PostgreSQL. nginx serves the site and proxies `/api/` to it. The site starts and serves pages without the API.

```bash
cp api/.env.example api/.env.local   # fill in the GitHub App and the recovery pepper
docker compose build --build-arg SITE_ORIGIN=http://localhost:8080 web
docker compose build api
docker compose up --no-build         # http://localhost:8080/sw/account/
```

- `api/.env.local` is git-ignored and is not sent to Docker builds. Secrets are never committed: compose reads them at run time.
- Open `http://localhost:8080`, not `127.0.0.1:8080`: the API checks each POST's origin against `SITE_ORIGIN` (`http://localhost:8080`) and refuses others with `bad_origin`.
- Only the site is published, on `127.0.0.1:8080`. The API and the database have no host port. This is a local development stack, not a production boundary.
- Sign in locally with Chromium or Firefox. The session cookie is `__Host-` and `Secure`, and Safari/WebKit refuses it on `http://localhost`.
- The rate limits live in the API's memory, so they reset whenever it restarts.
- GitHub requires the `redirect_uri` to match a registered callback. Register all three on the GitHub App: `/api/auth/github/callback`, `/api/auth/github/callback/reauth` and `/api/auth/github/callback/replace` (for example `http://localhost:8080/api/auth/github/callback`).

```bash
export TEST_DATABASE_URL=postgres://...   # a throwaway PostgreSQL database
npm run api:test
SITE_ORIGIN=http://localhost:4352 npm run build
npm run e2e:account                      # Chromium, against the real API and a fake GitHub
```

`npm run e2e:account` starts a fake GitHub (`api/test/fake-github-server.ts`) with a test-only consent page. It is not real GitHub authentication. CI runs both, validates `compose.yaml` and builds the API image.

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
