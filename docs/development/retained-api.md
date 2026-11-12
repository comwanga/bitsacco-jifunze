# Retained API maintenance and security

Jifunze is account-free. Account routes/components and their browser suites have been removed; no build flag restores them. The site uses local version 1 progress and plain email feedback and does not call the retained account API.

The `api/` source, API image, Compose API/PostgreSQL services and nginx proxy rules remain until a separate cleanup decision. Production has one static web service and rejects every `/api` route. Staging still runs private API/database services with an enforced empty tester allowlist; see [Staging operations](../deployment/railway-staging.md).

## Maintenance checks

From the repository root:

```bash
npm ci --prefix api
npm run api:typecheck
export TEST_DATABASE_URL=postgres://... # a disposable PostgreSQL database
npm run api:test
docker compose config -q
```

The `account` CI job checks the retained API, synthetic Railway ingress and nginx proxy/logging contracts. The former `e2e:account` and `e2e:allowlist` scripts no longer exist. A local `/sw/account/` address returns 404 like any other retired account URL; do not use old sign-in walkthroughs as setup instructions.

`api/.env.local` is ignored by Git and excluded from image builds. Compose reads it at runtime. Never copy API/database/OAuth/tester/trust settings into the production static service. The API's session-cookie, exact-origin, signature, recovery and tester-gate tests remain security constraints even though the site does not use the service.

## Logs and access

NGINX/API logs go to container stdout/stderr. Access to the Docker host or Railway operator account gives access to those logs; restrict it to operators.

- NGINX access logs use paths without query strings, truncate client addresses to IPv4 /24 or IPv6 /48, and omit API referrers, forwarding lists, cookies and bodies.
- The baseline API operational log contains method, route template, status and elapsed time, and can include an authenticated account ID. Treat that identifier as sensitive operator data; do not describe these logs as free of identifiers. Request bodies, session tokens, cookies, OAuth code/state and recovery codes must not be logged.
- NGINX error logs can quote a full request line/address. Exact registered GitHub callback paths use `crit` logging to suppress secret-bearing upstream error lines. A malformed callback-like path does not receive the same exception; the permanent proxy checks retain this boundary.
- Compose's local logging driver bounds size (three 10 MB files per container) but does not implement an age-based policy. The retained account policy calls for 14-day retention; a host/log shipper must enforce it. The seven-day Hobby exception was limited to controlled disposable staging, not authenticated production.

`bash scripts/check-proxy.sh` tests forwarding/address handling, callback log redaction and API loss in a disposable Docker stack. `node scripts/check-railway-proxy.mjs` tests the synthetic staging contract; it is not proof of live provider behavior.

## Future exposure or removal

Keeping this code is not authorization to expose accounts. Any future use requires an explicit architecture/security decision, exact-origin and cookie acceptance, a reviewed trusted-proxy boundary, independent client/rate-limit and forged-header tests, provider/signer acceptance, and operational recovery/log/privacy decisions. Staging's environment-wide trust exception is not suitable evidence for authenticated production.

Removing the retained API, proxy rules or database services also needs its own scoped cleanup. Do not drop database records, change allowlists or destroy Railway services while updating site documentation.
