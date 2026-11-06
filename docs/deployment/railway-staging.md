# Railway staging safeguards

Last verified during production acceptance on **2026-11-06**. Staging remains separate from the [anonymous production service](production.md).

| Item | Verified state |
| --- | --- |
| Project / environment | `bitsacco-jifunze` / `staging` (`1b138f86-2127-4c52-9142-868ecdf75460`) |
| Public origin | `https://staging.bitsaccojifunze.xyz`; noindex/nofollow, robots disallow all |
| Services | Public NGINX web; private Node API; private PostgreSQL |
| Web/API source | `deploy/railway-staging`, `af5559514cb475cef4d7cb6df7624db72713aeb0` |
| Web deployment | `4549aec0-324e-4032-9c57-306ceef68c79` |
| API deployment | `7ad5f149-4785-4461-8365-13a64fadecd7` |
| PostgreSQL deployment | `f8ac6eaf-5174-4157-9064-8304c295fe4e` |
| Status / deployment triggers | All three SUCCESS; web/API automatic deployment disabled, no triggers |
| Authentication | `STAGING_AUTH_ENABLED=0`; tester allowlist closed; no provider acceptance claimed |

Before any authorized staging change, capture environment/service IDs, source SHA, deployment IDs, domains, trigger settings, configuration ETag and redacted variable comparisons. Production acceptance preserved ETag `8f3a697a57105d8e9b93c5ce9fe823e46a2d68e4d9ae01879c3e70e55c2a4c77`. Do not log secrets. Deploy only the exact reviewed SHA, verify its actual deployment metadata, and compare the baseline afterward. Never infer the source commit from a branch label or variable save.

Keep API/database private, authentication disabled and tester variables unchanged unless separately authorized. Do not duplicate this environment into production. The explicit isolated-staging proxy trust decision below accepts a trusted private co-tenant boundary; it does **not** approve future authenticated production. Live GitHub consent, real Nostr signer acceptance, durable off-service database backups and account-release log/privacy acceptance remain separate gates. The static production site has no account database to back up.

## Historical preparation and ingress evidence (2026-11-05)

The remainder preserves earlier snapshots, proposed activation steps, security findings and verification limitations. Statements such as “not deployed”, CLI unauthenticated, missing HSTS, automatic localhost probing and pending branch CI describe their original checkpoint, not the current state above. The tester/canonical-host gates were subsequently deployed at `af555951`; production later made lab discovery user-initiated. Railway repository access was restored before production deployment; the earlier `NO_INSTALLATION` reason is historical. No authentication activation is authorized by these archived instructions.

This is a controlled staging deployment, not general authentication release. Railway staging builds from `deploy/railway-staging`; keep that branch. Do not enable authentication without authorization.

## Earlier staging snapshot (2026-11-05)

| Item | State |
|---|---|
| Domain | `staging.bitsaccojifunze.xyz`: DNS public, Railway verified, Let's Encrypt certificate valid to 2027-02-03 |
| Authentication | Disabled: `STAGING_AUTH_ENABLED=0`; `/api/*` except health and hidden internal paths returns 503 at nginx |
| Web deployment | `3a02083` from `deploy/railway-staging`, CI passed |
| API deployment | `6d418dc` (the `main` merge of PR #8); `api/` and `docker/api.Dockerfile` are identical to `3a02083` |
| GitHub App | Private staging App owned by the maintainer; 0 repository, organization and account permissions; the three callbacks below registered exactly, wildcards, device flow and webhook off; Railway holds its Client ID and secret. While it is private, plan on only its owner being able to authorize it: other GitHub testers need it made public, which needs approval |
| Railway source | `web` and `api` have `source.branch=deploy/railway-staging`; no triggers; auto-deploy off |
| Tester allowlist and gate, canonical-host gate, HSTS | Implemented, **not yet deployed** |

### Deployment source

Before 2026-11-05 the `web` and `api` services had a repository source and no branch. Saving the GitHub credentials in the dashboard then created an API deployment from `main` HEAD (`6d418dc`), not from this branch. It was harmless because the API code was identical. The `branch` value in deployment metadata is not reliable evidence (`4af4266`, which is not on `main`, is also labelled `main`): check the commit.

Both services now have `source.branch=deploy/railway-staging`, set with `environmentPatchCommit` and `skipDeploys: true`. That created no deployment; the commits and image digests were unchanged. Auto-deploy is off (`serviceInstanceAutoDeployStatus`: `enabled=false`, `reason=NO_INSTALLATION`, because Railway's GitHub App has no installation for this repository) and there are no triggers, so a push deploys nothing.

Whether a dashboard variable save now builds from the pinned branch has not been observed, because proving it takes a deployment. Until the next authorized deployment shows it, **do not apply a staged variable change or use a dashboard deploy on these services**: use the procedure below and confirm the deployed commit. The tester gate limits the damage if this is ever missed: an API without the allowlist cannot serve authentication.

### Controlled activation (each step needs authorization)

1. Review and publish this branch; wait for CI.
2. Set the lists without deploying: `railway variable set TESTER_GITHUB_IDS=... TESTER_NOSTR_PUBKEYS=... --skip-deploys -s api -e staging`.
3. Deploy the API at the exact commit, then the web service, with authentication still off: `serviceInstanceDeployV2(serviceId, environmentId, commitSha)`.
4. Confirm both commits with `railway deployment list --json`, and the API boot line `event="tester_allowlist"` with `enforced=true`, the expected counts and `invalid=[]`.
5. Confirm live, with authentication still off: HSTS on the custom domain; on the generated hostname, public pages and health 200 and `/api/me` 404.
6. Set `STAGING_AUTH_ENABLED=1 --skip-deploys` on web and deploy web at the same exact commit. Repeat step 4's commit check. Roll back by setting it to `0` the same way.

Any later API or web deployment repeats steps 3 and 4 before testing continues.

## Tester allowlist

Learning content stays public. Authentication is limited to the identities in two API variables:

- `TESTER_GITHUB_IDS`: comma-separated GitHub numeric user ids (not logins, which can change hands). `gh api users/<login> --jq .id` shows one.
- `TESTER_NOSTR_PUBKEYS`: comma-separated lowercase 64-character hex public keys (not `npub`).

Required on every Railway environment except one named `production` on the production origin, and enforced anywhere either variable is present. **Missing, empty or malformed means nobody can authenticate**; one bad entry denies everyone, and the boot line names the variable, never a value. The API deliberately stays healthy in that state rather than failing its boot: a failed deployment can leave the previous one, possibly with no allowlist, serving.

| Path | Check | Refused as |
|---|---|---|
| GitHub sign-in, reauth, replace | After GitHub proves the identity, before any change | Same as a stale request (`state_invalid`) |
| Nostr verify | After the signature, URL, payload and proof checks; challenge spent | Same as a spent challenge (`challenge_invalid`) |
| Recovery code | After the code matches; transaction rolled back, so the code stays unspent | Same as a wrong code (`recovery_invalid`) |
| Any existing session | On every request, in the one session gate in `api/src/http.ts` | Treated as no session |

To remove a tester, change the variable and redeploy the API by the procedure above: their sessions and recovery codes stop working immediately, with no database change, and work again if they are re-added. Their account row remains. A test asserts that `createSession` has only these four callers, so a new session path fails the suite until it is reviewed.

While authentication is enabled, nginx asks the API's `/api/internal/tester-gate` before forwarding any API request. A deployment without an allowlist, such as one built from `main`, has no such route (or answers 404), so nginx answers 500 and forwards nothing; learning pages are unaffected. Web must already run this code before `STAGING_AUTH_ENABLED=1` is set: the currently deployed web (`3a02083`) has no gate, so setting it today would expose the API as it stands.

The refusals reuse approved copy in both languages, so an unlisted person sees "start again". This is deliberate: it does not confirm the allowlist decided it. A tester who is wrongly refused should send the maintainer their numeric id.

## Canonical origin and the generated hostname

`https://staging.bitsaccojifunze.xyz` is the only authentication origin. OAuth redirects, NIP-98 URLs and the API's origin check all come from `SITE_ORIGIN`. In Railway mode nginx also answers every `/api/*` path except health with a JSON 404 unless the hostname equals `SITE_ORIGIN`'s, whatever `STAGING_AUTH_ENABLED` says. Without this, a person could finish a real flow on `web-staging-d337.up.railway.app` by moving a callback there by hand, and hold a session on a second origin. Public pages and health remain on the generated hostname; removing that Railway domain is optional and was not done.

## Reviewed findings

- **HSTS:** absent on the live site. Railway mode now sends `max-age=86400`: this host only, one day, no `includeSubDomains` or `preload`, so it cannot bind the production root. Production needs its own decision.
- **Account error while disabled:** the page blamed the reader's internet connection for nginx's 503. A non-JSON 5xx now shows the existing "something went wrong on our side" copy in both languages; no wording changed. "Continue with GitHub" still shows nginx's plain 503 while authentication is off, which ends at activation.
- **Local Lightning lab:** Lightning lessons call `127.0.0.1:7777/hello` on load to find an optional lab, so Chrome and Edge may ask for local network access. This is the designed behaviour (`docs/superpowers/specs/2026-11-03-lightning-lab-design.md`) and the page explains it. No change; tell testers that declining does not affect sign-in.
- **Private-network trust boundary:** rechecked against Railway's environment configuration: exactly `web`, `api` and `postgres`; only `web` has a public domain; no TCP proxies. The accepted limitation below is unchanged, and neither the allowlist nor the canonical-host gate relies on client addresses. A private co-tenant could still reach the API directly, which is why adding one invalidates this acceptance.

## Execution plan

1. Preserve PR #8 and its signed history. Use the existing static-export/nginx and Node 24 API Dockerfiles, with PostgreSQL 16 on a new persistent staging volume.
2. Make the web build take its public origin from `SITE_ORIGIN`; default production metadata to `https://bitsaccojifunze.xyz`. Non-production origins receive robots noindex/disallow. Pass only public configuration as web build arguments; never API secrets.
3. Adapt nginx at runtime only when `JIFUNZE_HOSTING=railway`: discover its actual container DNS resolvers, use the API's Railway private domain and fixed port, preserve same-origin routing and callback-log redaction, and forward HTTPS correctly.
4. Keep authentication disabled while static pages and `/api/health` are checked. Railway has no exclusive ingress CIDRs. Use only the explicit isolated-staging environment trust decision below; never describe guessed peer ranges as verified. Validate a single normalized client address and HTTPS protocol; malformed values and unexpected configuration fail closed. Activation remains a separate maintainer decision after live ingress/privacy tests.
5. Authenticate the maintainer's Railway CLI, inspect existing projects/workspace/plan and obtain approval for any paid resources. Use current CLI/API/dashboard service settings; no deprecated `railway.toml`/`railway.json` and no additional application infrastructure SDK dependency.
6. Provision only the approved staging environment: web public, API private, PostgreSQL private with persistent storage. No API domain or database TCP proxy. One API replica preserves the existing in-memory rate-limit model.
7. Add `staging.bitsaccojifunze.xyz` to web and retrieve the real generated CNAME/TXT records. The maintainer changes only those records in Namecheap; nameservers and unrelated records stay intact. Do not attach the production root domain yet.
8. The maintainer creates the separate staging GitHub App and enters its client credentials directly in Railway. Preserve exact OAuth callbacks, PKCE/state/browser binding, secure cookies and the existing recovery pepper. Do not enter credentials in chat.
9. Run sequential local configuration/metadata/proxy tests and image builds, then staging HTTPS, proxy/header/rate-limit/logging, persistence and backup/restore checks. Use synthetic identities and markers only. Real GitHub consent and external Nostr signer acceptance remain maintainer actions.

## Historical preparation preflight (before provisioning)

- Local and published implementation HEAD match; working tree was clean before the separate worktree was created. No unrelated local work changed.
- Railway CLI 5.63.1 is installed but currently unauthenticated. Project, workspace, plan, cost and resource availability on Railway are not yet verified.
- No Railway services, paid resources, domains or DNS records have been created by this preparation.
- Public DNS on 2026-11-05 confirms `dns1.registrar-servers.com` / `dns2.registrar-servers.com`; a public-resolver lookup returned NXDOMAIN for the staging name. No DNS modifications were made.
- The old domain in historical specifications/spikes is evidence of earlier proposals and should remain historical. Active metadata and runtime configuration must use the new environment origin.

## Service settings

| Service | Source/build | Network | Settings |
|---|---|---|---|
| web | Existing root Dockerfile, repository root context | Only public service, port 8080 | Public build argument/runtime `SITE_ORIGIN=https://staging.bitsaccojifunze.xyz`, `JIFUNZE_HOSTING=railway`, `PORT=8080`, `API_HOST=${{api.RAILWAY_PRIVATE_DOMAIN}}`, `API_PORT=3001`, `NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1`, `STAGING_AUTH_ENABLED=0`; health `/en/` remains independent of API availability. After approval, opt in to `RAILWAY_TRUST_MODEL=isolated-staging`; Railway's environment name must be `staging`. Leave `TRUSTED_PROXY_CIDRS` unset. |
| api | `docker/api.Dockerfile`, repository root context | Private only, port 3001 | `RAILWAY_DOCKERFILE_PATH=docker/api.Dockerfile`, `PORT=3001`; `SITE_ORIGIN` exactly staging HTTPS origin; `DATABASE_URL` references PostgreSQL's private connection; staging `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, persistent `RECOVERY_PEPPER_V1`; `TESTER_GITHUB_IDS`, `TESTER_NOSTR_PUBKEYS`; health `/api/health`; one replica |
| postgres | PostgreSQL 16 image/version confirmed before creation | Private only, no TCP proxy | New staging database and random credentials in Railway only; persistent data volume; backup schedule and restore drill |

API startup already applies pending SQL migrations under advisory locks and transactions before it starts listening. Failure logs contain only a migration filename/error code. Verify the migration ledger and idempotent restart on the actual staging database; never use the local development URL. Deploy rollback restores prior images; database rollback requires a compatible forward migration or a tested backup, not destructive schema changes.

## Domain and OAuth handoff

DNS, domain ownership, the certificate and public HTTPS are verified. These callbacks are registered on the staging GitHub App:

- `https://staging.bitsaccojifunze.xyz/api/auth/github/callback`
- `https://staging.bitsaccojifunze.xyz/api/auth/github/callback/reauth`
- `https://staging.bitsaccojifunze.xyz/api/auth/github/callback/replace`

Use no repository permissions or webhook configuration beyond the existing sign-in requirements. The API needs OAuth client credentials, not an App private key, for this increment. Keep the recovery pepper stable across restarts and back it up securely with the deployment's secret inventory.

## Ingress and privacy acceptance

- Confirm the actual runtime DNS resolves the API's private domain and that the selected port is reachable. Railway supports private IPv6 in both legacy and new environments; nginx selects private IPv6 upstreams and listens on both IPv4/IPv6. Verify that the actual API socket peer is a private ULA recognized by the existing API trusted-peer policy. Do not broaden API trust to an unverified platform IPv4 range. Stop/restart the API: learning pages must continue to work and account requests must fail visibly without cached authentication data.
- Recheck that this isolated environment has only the three trusted services and that only web has public ingress. Accept the documented environment-level boundary below explicitly; do not infer exclusive edge identity from observed peer addresses. Adding any co-tenant or public API/database ingress invalidates this acceptance and requires review.
- From client A, exhaust the existing wrong-recovery-code limit; client B on another network must still receive 401, not 429. Repeat A with forged `X-Real-IP`, `X-Forwarded-For` and `Forwarded`; A must stay limited. Verify HTTP redirects, forwarded protocol and cookie flags without recording cookie values.
- Send synthetic OAuth callback code/state markers, including an upstream-unavailable and oversized-header request. Inspect Railway HTTP/build/deploy logs and nginx/API logs for the markers, raw query strings, cookies and Authorization. Do not use a real OAuth code for this check. App redaction is not evidence of edge redaction.
- Check directory redirects through the actual HTTPS edge, including a real directory under `/_next/static/`. The Railway nginx mode emits relative redirects so the inner HTTP connection cannot produce a public HTTP/8080 Location. The plain-HTTP stand-in is not TLS/edge acceptance.
- Keep CDN caching disabled for authenticated routes, enforce no-store, inspect service-worker caches and test offline lessons. Check no mixed content, no stale origin and the exact NIP-98 challenge URL.

## Log retention discrepancy

Railway currently documents Free 3 days, Trial/Hobby 7 days and Pro 30 days. It also states that upgrading can restore logs outside the prior display retention period. The active Hobby plan provides seven days; the maintainer approved this exception for controlled staging with disposable accounts only. Physical deletion/custom retention is not established. Do not claim Jifunze's approved 14-day production application-log policy is satisfied.

Before general release, obtain provider confirmation of deletion/custom retention, or approve a minimal 14-day external log store and suppress duplicate sensitive application logs at the provider. Exporting logs alone cannot erase Railway's longer-retained copies or edge logs. The staging exception does not alter production policy or authorize another service.

## Backup and restore acceptance (required before general release)

The approved policy is encrypted daily logical dumps (7 daily, 4 weekly), provider PITR where available, RPO 24h and RTO 4h, with quarterly restore drills. Railway volume snapshots currently retain 6 daily/27-day weekly/89-day monthly backups; this differs from the approved logical-dump policy. Snapshot schedules alone are not claimed to satisfy it.

Record the actual staging volume, size, encryption/access controls, schedule, restore target and measured times. Create a non-secret sentinel in a dedicated acceptance table, perform the approved backup, restore into an isolated PostgreSQL 16 instance/volume, and verify the sentinel, schema migration ledger and account/identity/recovery/session constraints. Never print credential hashes, session tokens or recovery codes. Test before using live learner data. Confirm persistence through an application restart independently of backup restoration. No backup or restoration is currently claimed.

## Maintainer acceptance after HTTPS is healthy

Use the exact staging URL above and a disposable, unfunded identity managed by an independently developed signer. The maintainer personally creates/restores the identity, handles encrypted backup where supported, and grants/rejects/cancels signing consent. Never share or capture nsec, seed words, signer passwords, recovery codes or backup material.

In English and Kiswahili: detect the signer; approve first login; verify one internal account and ten initial recovery codes; save codes privately; sign out; return with the same public key and verify the same account without another initial set; reject/cancel safely; use browser Back and authenticate again; check recovery scope/revocation. Record only non-secret outcomes. Separately test real GitHub consent, return, reauthentication and recovery replacement on the staging App.

## Sources checked 2026-11-05

- [Current configuration mechanism](https://docs.railway.com/config-as-code) and [CLI](https://docs.railway.com/cli)
- [Private networking](https://docs.railway.com/networking/private-networking/how-it-works)
- [Public edge headers/TLS](https://docs.railway.com/networking/public-networking/specs-and-limits)
- [Domains and DNS verification](https://docs.railway.com/networking/domains/working-with-domains)
- [Logs and retention](https://docs.railway.com/observability/logs)
- [Volume backups](https://docs.railway.com/volumes/backups)
- [Pricing](https://docs.railway.com/pricing/plans)

Actual deployment IDs, service health, DNS records, selected-plan cost, acceptance results and remaining blockers must be added after verification. None are inferred from local tests.

## Local preparation evidence

The following preparation results describe the original baseline. The current ingress decision and subsequent verification follow this historical evidence.

- Nine new origin tests failed against the original placeholder configuration, then passed with the implementation. The focused origin/metadata run passed 10 tests; the complete repository suite passed **144 tests**. Site typechecking passed with a 512 MiB heap (256 MiB was insufficient).
- The final synthetic nginx contract passed **29 checks**, including private IPv6 transport, distinct client identities, forged forwarding headers, unknown-peer rejection, no-store, relative directory redirects, disabled-auth behavior, callback redaction in both log streams, unavailable API behavior and web restart/idempotence. It uses an echo upstream and a stand-in front proxy, not Railway or live OAuth/Nostr acceptance.
- The staging Docker web build passed and its actual export passed: **110 application pages have noindex**, robots disallows crawling, and **282 sitemap/language URLs** use the staging origin. This includes the separately rooted `/` redirect page; the export test caught its missing noindex before correction. nginx's vendor `50x.html` is covered by HTTP X-Robots-Tag rather than application metadata.
- The built image's non-root entrypoint and `nginx -t` passed. The final relative-redirect refinement was subsequently verified by the synthetic contract; the complete final-tree image build is also required by the new CI step before deployment. No hosted deployment is claimed from this local image.
- **Zero gzip JavaScript change on all 110 application pages** against the footer implementation export. Existing UX budgets pass; no threshold changes or new packages. Export worker concurrency is bounded to two to limit builder/workstation memory.
- **41 lab unit tests passed in the Linux lab image**, including both registered-domain origins; existing Python resource warnings remain. Native Windows and an incomplete fixture mount were not valid full-lab test environments; their failed exploratory logs are retained separately. Lab model exercises were not rerun locally for this domain-allowlist change and remain in CI.
- No authentication API source, signature verification, schema migration, account/session/recovery behavior, approved wording or learning-progress code changed. The lab's paired local bridge changes only its default exact-origin allowlist for the newly registered domains.
- Final deployment-branch CI and the full browser suites await authorized publication. The original implementation's green CI belongs to `8d8f574`, not this new deployment branch. Heavy native browser checks were deferred while available workstation RAM fell below 200 MiB; local Docker tests ran sequentially in the existing VM's available memory.
- No real Railway client-IP, edge logs, custom-domain TLS, live GitHub, Nostr signer, database persistence or backup/restore acceptance has been performed. Language approval from 2026-11-05 is preserved; legal/operational/live-signer general-release gates remain open.

## Staging ingress decision — 2026-11-05

**Root cause.** The original configuration required an exclusive, stable proxy CIDR allowlist. Railway does not provide that contract or an application-verifiable signed edge identity. Observed socket addresses cannot supply it. See [provider support confirmation](https://station.railway.com/questions/asp-net-core-trusted-ingress-boundary-an-ea6cad35), [public header specifications](https://docs.railway.com/networking/public-networking/specs-and-limits) and [private-network isolation](https://docs.railway.com/networking/private-networking/how-it-works).

**Verified provider behavior.** The public HTTPS edge replaces client-supplied X-Real-IP and forwarded protocol. Private callers bypass normalization. Networks are isolated by project/environment. RFC Forwarded is not an authoritative source; no X-Forwarded-For position is used.

**Explicit staging assumption.** The operator trusts all workloads and operators within this environment: web, API and PostgreSQL. They form one security boundary. Before opting in, verify exactly those three services, only NGINX public, no API/database domains or TCP proxies, and reviewed deployment sources. The new mode is gated by `RAILWAY_TRUST_MODEL=isolated-staging`, `RAILWAY_ENVIRONMENT_NAME=staging` and an HTTPS `SITE_ORIGIN`. No automatic production opt-in exists. Authentication has a separate switch and remains disabled by default.

**Implementation.** In this explicit mode the realip module accepts input from all peers (`0.0.0.0/0` and `::/0`), deliberately expressing environment-wide trust, not an exclusive/verified Railway CIDR. Header shape checks reject missing, duplicate/comma-separated, port-bearing, scoped or non-numeric forms. NGINX's native address parser rejects invalid octets/IPv6 and emits one canonical address. Unchanged socket-address fallback fails closed on protected API routes. Unexpected forwarded protocol is rejected. NGINX removes X-Forwarded-For/Forwarded and supplies one X-Real-IP plus HTTPS to the private API. The unchanged API normalizes mapped IPv4 and derives IPv6 /64 limiter keys from bytes. Health and hidden internal paths retain their existing exceptions; neither provides authentication.

**Residual limitation.** Header validation does not authenticate the edge. A compromised or untrusted private co-tenant can submit any valid X-Real-IP directly to NGINX or the API. This was reproduced, not merely assumed. This bounded model is sufficient for controlled staging with trusted workloads and disposable accounts, subject to maintainer authorization. It is not approval for unrestricted production. Any workload/access-path change requires another review; IP limits also cannot distinguish users sharing one NAT and are not account-ownership proofs.

### Real Railway verification (temporary probe, no authentication enabled)

- Rechecked project `9a7612e6-649f-44ca-91db-45977f0a8c41`, environment `staging`, exactly three healthy one-replica services, only web public; source SHA `4af42665d3895482a412b8d23ef4932cdfca69f5`.
- Temporarily rendered the new policy on the existing web service and exposed only a non-authentication health probe to a temporary process in the existing API container. It imported the deployed API's actual `clientIp`, `normaliseIp`, `perIp` and `Limiter`. No authentication route was opened, extra Railway service created, source pushed or DNS modified. All runtime probe code/config was removed/restored afterward.
- Client A: maintainer workstation's public network. Client B: existing API container using SFO public egress to the public HTTPS hostname, not its private URL. Railway HTTP logs confirmed distinct public source addresses on the same public host. An attempted web-fetch-tool second source was inaccessible and is not counted.
- A received 200,200,200,429; B independently received 200,200,200,429. Opaque client tags differed (`a0339898a1e66263c7db` vs `5ba8640b1d00668d8387`). First request IDs: A `vd_6rRWLTX20R45ILPU1MQ`, B `sYCy8tJDQFeF19JFY53eZw`. No full client addresses were written to this evidence.
- Six attempts from limited A using forged addresses, malformed lists, a port-bearing IPv6 literal, a scoped address and forged XFF/Forwarded/protocol remained 429 with A's original tag. The API received a valid canonical client address, HTTPS, correct public Host, private IPv6 transport and no XFF/Forwarded.
- Nine malformed direct-private address forms returned 403. A valid forged direct-private address returned 200, demonstrating the residual co-tenant trust. Public internal visibility stayed 404; public Nostr challenge stayed 503 without a cookie.
- Stopping the non-authentication upstream produced a real 502/no-store while English learning remained 200. The original API's outage/restart behavior was also verified during provisioning. Restoring published NGINX configuration restored normal health. This is not an authenticated callback or live OAuth/Nostr acceptance test.
- Initial probe setup attempts failed SSH/validation before reload because of operator-session log/PID permissions; they are not counted as live-policy passes. The successful policy was validated with a separate operator-owned validation PID file and reloaded, then restored.

### Verification and remaining release gates

Focused Docker ingress contract: 46 checks passed, including malformed/duplicate headers, canonical IPv6/mapped addresses, distinct clients, private co-tenant residual trust, no-store, relative redirects, restart, callback log privacy, upstream loss and invalid opt-in configurations. The original implementation failed the explicit-mode test with `verified TRUSTED_PROXY_CIDRS required before authentication` before the correction.

The full API regression passed 206 tests against the existing disposable PostgreSQL test database, including GitHub, Nostr, recovery, account/session ownership, canonical-address limiter keys and transaction/concurrency cases. The private deployed API retained the exact NIP-98 URL, Secure/HttpOnly/SameSite=Lax/Path=/ pre-auth cookie, wrong-origin 403 and missing-signature 401/no-session behavior; account/session counts stayed zero. These attribute checks do not claim a live authenticated browser session. Repository tests passed 144 cases. The existing export passed UX budgets; a new production build and browser suites were not rerun for this server-configuration-only change. Local regression host was Node 24.19.0; deployed API/probe ran Node 24.22.2 and nginx was tested in its Linux image. No browser process was launched under the workstation's memory pressure.

No API authentication/recovery logic, schema, frontend, translations, dependencies or JavaScript budgets changed. GitHub callbacks and exact NIP-98 origin/body/signature verification remain the original implementation. Session-cookie and real-signer acceptance do not follow merely from a forwarding test. This correction has since been published and deployed to web, and the custom domain and staging GitHub App are configured. Live provider consent remains a separate authorization/acceptance step.

The approved seven-day Hobby log exception applies only to disposable staging data; production's fourteen-day requirement is unchanged. Native scheduled/manual backups were rejected as Pro-only during provisioning; no plan change was made. The logical restore drill passed, but durable off-service backups remain a general-release gate.
