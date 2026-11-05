# Railway staging: preparation and acceptance

This is a controlled staging deployment, not general authentication release. Base implementation: `8d8f574cbe96d9a393043d3690b8ed03ad770aaa` (PR #8, open, CI check/account/lab all passed). Work is isolated on `deploy/railway-staging`; do not merge PR #8 or push this deployment branch without separate authorization.

## Execution plan

1. Preserve PR #8 and its signed history. Use the existing static-export/nginx and Node 24 API Dockerfiles, with PostgreSQL 16 on a new persistent staging volume.
2. Make the web build take its public origin from `SITE_ORIGIN`; default production metadata to `https://bitsaccojifunze.xyz`. Non-production origins receive robots noindex/disallow. Pass only public configuration as web build arguments; never API secrets.
3. Adapt nginx at runtime only when `JIFUNZE_HOSTING=railway`: discover its actual container DNS resolvers, use the API's Railway private domain and fixed port, preserve same-origin routing and callback-log redaction, and forward HTTPS correctly.
4. Initially keep authentication disabled at nginx while static pages and `/api/health` can be checked. Do not guess edge CIDRs or trust client-supplied forwarding headers. Enable authentication only after actual Railway peer ranges/header overwrite behavior and provider logging are verified. Unknown proxy peers must fail closed.
5. Authenticate the maintainer's Railway CLI, inspect existing projects/workspace/plan and obtain approval for any paid resources. Use current CLI/API/dashboard service settings; no deprecated `railway.toml`/`railway.json` and no additional application infrastructure SDK dependency.
6. Provision only the approved staging environment: web public, API private, PostgreSQL private with persistent storage. No API domain or database TCP proxy. One API replica preserves the existing in-memory rate-limit model.
7. Add `staging.bitsaccojifunze.xyz` to web and retrieve the real generated CNAME/TXT records. The maintainer changes only those records in Namecheap; nameservers and unrelated records stay intact. Do not attach the production root domain yet.
8. The maintainer creates the separate staging GitHub App and enters its client credentials directly in Railway. Preserve exact OAuth callbacks, PKCE/state/browser binding, secure cookies and the existing recovery pepper. Do not enter credentials in chat.
9. Run sequential local configuration/metadata/proxy tests and image builds, then staging HTTPS, proxy/header/rate-limit/logging, persistence and backup/restore checks. Use synthetic identities and markers only. Real GitHub consent and external Nostr signer acceptance remain maintainer actions.

## Current preflight

- Local and published implementation HEAD match; working tree was clean before the separate worktree was created. No unrelated local work changed.
- Railway CLI 5.63.1 is installed but currently unauthenticated. Project, workspace, plan, cost and resource availability on Railway are not yet verified.
- No Railway services, paid resources, domains or DNS records have been created by this preparation.
- Public DNS on 2026-11-05 confirms `dns1.registrar-servers.com` / `dns2.registrar-servers.com`; a public-resolver lookup returned NXDOMAIN for the staging name. No DNS modifications were made.
- The old domain in historical specifications/spikes is evidence of earlier proposals and should remain historical. Active metadata and runtime configuration must use the new environment origin.

## Intended service settings (not yet provisioned)

| Service | Source/build | Network | Settings |
|---|---|---|---|
| web | Existing root Dockerfile, repository root context | Only public service, port 8080 | Public build argument/runtime `SITE_ORIGIN=https://staging.bitsaccojifunze.xyz`, `JIFUNZE_HOSTING=railway`, `PORT=8080`, `API_HOST=${{api.RAILWAY_PRIVATE_DOMAIN}}`, `API_PORT=3001`, `NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1`, `STAGING_AUTH_ENABLED=0`; health `/en/` remains independent of API availability; set `TRUSTED_PROXY_CIDRS` only from verified ingress evidence before enabling authentication |
| api | `docker/api.Dockerfile`, repository root context | Private only, port 3001 | `RAILWAY_DOCKERFILE_PATH=docker/api.Dockerfile`, `PORT=3001`; `SITE_ORIGIN` exactly staging HTTPS origin; `DATABASE_URL` references PostgreSQL's private connection; staging `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, persistent `RECOVERY_PEPPER_V1`; health `/api/health`; one replica |
| postgres | PostgreSQL 16 image/version confirmed before creation | Private only, no TCP proxy | New staging database and random credentials in Railway only; persistent data volume; backup schedule and restore drill |

API startup already applies pending SQL migrations under advisory locks and transactions before it starts listening. Failure logs contain only a migration filename/error code. Verify the migration ledger and idempotent restart on the actual staging database; never use the local development URL. Deploy rollback restores prior images; database rollback requires a compatible forward migration or a tested backup, not destructive schema changes.

## Domain and OAuth handoff

DNS values are **pending actual Railway domain creation**. Do not invent a CNAME target or TXT verification token. In Namecheap Advanced DNS, add only the exact records Railway returns. A staging CNAME normally uses host `staging`; use Railway's actual TXT host/value exactly. Verify DNS propagation, certificate issuance and public HTTPS before authentication acceptance.

Register these callbacks on the staging GitHub App:

- `https://staging.bitsaccojifunze.xyz/api/auth/github/callback`
- `https://staging.bitsaccojifunze.xyz/api/auth/github/callback/reauth`
- `https://staging.bitsaccojifunze.xyz/api/auth/github/callback/replace`

Use no repository permissions or webhook configuration beyond the existing sign-in requirements. The API needs OAuth client credentials, not an App private key, for this increment. Keep the recovery pepper stable across restarts and back it up securely with the deployment's secret inventory.

## Ingress and privacy acceptance

- Confirm the actual runtime DNS resolves the API's private domain and that the selected port is reachable. Railway supports private IPv6 in both legacy and new environments; nginx selects private IPv6 upstreams and listens on both IPv4/IPv6. Verify that the actual API socket peer is a private ULA recognized by the existing API trusted-peer policy. Do not broaden API trust to an unverified platform IPv4 range. Stop/restart the API: learning pages must continue to work and account requests must fail visibly without cached authentication data.
- Obtain the actual trusted edge peer addresses/ranges from Railway configuration/support and controlled network inspection. Do not infer a trusted CIDR from one truncated client log or use all private networks. Exact observed peer pinning is staging-only until the provider confirms its stability/ranges.
- From client A, exhaust the existing wrong-recovery-code limit; client B on another network must still receive 401, not 429. Repeat A with forged `X-Real-IP`, `X-Forwarded-For` and `Forwarded`; A must stay limited. Verify HTTP redirects, forwarded protocol and cookie flags without recording cookie values.
- Send synthetic OAuth callback code/state markers, including an upstream-unavailable and oversized-header request. Inspect Railway HTTP/build/deploy logs and nginx/API logs for the markers, raw query strings, cookies and Authorization. Do not use a real OAuth code for this check. App redaction is not evidence of edge redaction.
- Check directory redirects through the actual HTTPS edge, including a real directory under `/_next/static/`. The Railway nginx mode emits relative redirects so the inner HTTP connection cannot produce a public HTTP/8080 Location. The plain-HTTP stand-in is not TLS/edge acceptance.
- Keep CDN caching disabled for authenticated routes, enforce no-store, inspect service-worker caches and test offline lessons. Check no mixed content, no stale origin and the exact NIP-98 challenge URL.

## Log retention discrepancy

Railway currently documents Free 3 days, Trial/Hobby 7 days and Pro 30 days. It also states that upgrading can restore logs outside the prior display retention period. Neither the selected plan nor a configurable deletion policy has been verified. Do not claim Jifunze's approved 14-day application-log retention is satisfied.

Before general release, obtain provider confirmation of deletion/custom retention, or approve a minimal 14-day external log store and suppress duplicate sensitive application logs at the provider. Exporting logs alone cannot erase Railway's longer-retained copies or edge logs. Any staging policy exception must be explicitly recorded by the maintainer; do not silently change the approved policy or buy another service.

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

- Nine new origin tests failed against the original placeholder configuration, then passed with the implementation. The focused origin/metadata run passed 10 tests; the complete repository suite passed **144 tests**. Site typechecking passed with a 512 MiB heap (256 MiB was insufficient).
- The final synthetic nginx contract passed **29 checks**, including private IPv6 transport, distinct client identities, forged forwarding headers, unknown-peer rejection, no-store, relative directory redirects, disabled-auth behavior, callback redaction in both log streams, unavailable API behavior and web restart/idempotence. It uses an echo upstream and a stand-in front proxy, not Railway or live OAuth/Nostr acceptance.
- The staging Docker web build passed and its actual export passed: **110 application pages have noindex**, robots disallows crawling, and **282 sitemap/language URLs** use the staging origin. This includes the separately rooted `/` redirect page; the export test caught its missing noindex before correction. nginx's vendor `50x.html` is covered by HTTP X-Robots-Tag rather than application metadata.
- The built image's non-root entrypoint and `nginx -t` passed. The final relative-redirect refinement was subsequently verified by the synthetic contract; the complete final-tree image build is also required by the new CI step before deployment. No hosted deployment is claimed from this local image.
- **Zero gzip JavaScript change on all 110 application pages** against the footer implementation export. Existing UX budgets pass; no threshold changes or new packages. Export worker concurrency is bounded to two to limit builder/workstation memory.
- **41 lab unit tests passed in the Linux lab image**, including both registered-domain origins; existing Python resource warnings remain. Native Windows and an incomplete fixture mount were not valid full-lab test environments; their failed exploratory logs are retained separately. Lab model exercises were not rerun locally for this domain-allowlist change and remain in CI.
- No authentication API source, signature verification, schema migration, account/session/recovery behavior, approved wording or learning-progress code changed. The lab's paired local bridge changes only its default exact-origin allowlist for the newly registered domains.
- Final deployment-branch CI and the full browser suites await authorized publication. The original implementation's green CI belongs to `8d8f574`, not this new deployment branch. Heavy native browser checks were deferred while available workstation RAM fell below 200 MiB; local Docker tests ran sequentially in the existing VM's available memory.
- No real Railway client-IP, edge logs, custom-domain TLS, live GitHub, Nostr signer, database persistence or backup/restore acceptance has been performed. Language approval from 2026-11-05 is preserved; legal/operational/live-signer general-release gates remain open.
