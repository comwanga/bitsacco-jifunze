# Initial anonymous public release

Prepared 2026-11-05. This document records preparation, not live production acceptance. GitHub Draft PR publication has now been authorized by the maintainer. Railway provisioning/deployment and DNS changes still require separate authorization.

## Source and verified staging baseline

- Repository: `comwanga/bitsacco-jifunze`; PR #9 merged; fetched main is `21a7c48edcf8244aa0513aef322faf11cda87541`.
- Local release branch: `release/public-education`, based on main. Implementation commit: `d1f7087cc7da82a338d56a22dda6a2405a00399c`; verification source commit: `7a6f74d89289f0d95c06cffecf7102bb3e6e5fd8` (focused test-selector correction). Both SSH signatures verified. No push or merge performed.
- Railway project: `bitsacco-jifunze`, ID `9a7612e6-649f-44ca-91db-45977f0a8c41`; existing environment `staging`, ID `1b138f86-2127-4c52-9142-868ecdf75460`.
- Web deployment `4549aec0-324e-4032-9c57-306ceef68c79` and API deployment `7ad5f149-4785-4461-8365-13a64fadecd7` both SUCCESS, source `af5559514cb475cef4d7cb6df7624db72713aeb0`. PostgreSQL deployment `f8ac6eaf-5174-4157-9064-8304c295fe4e` SUCCESS.
- Exactly three staging service instances: web, api, postgres. Only web has public domains: `staging.bitsaccojifunze.xyz` and its existing Railway hostname. API/PostgreSQL have no public HTTP domains.
- Web and API source configuration pins `deploy/railway-staging`. Both have zero deployment triggers and auto-deploy disabled (`NO_INSTALLATION`). These boundaries were read, not changed.
- Staging web retains `STAGING_AUTH_ENABLED=0`, `RAILWAY_TRUST_MODEL=isolated-staging` and the staging origin. Tester identity variables are empty/unset; the deployed allowlist remains closed. No allowlist configuration or authentication acceptance was attempted.
- Baseline configuration ETag: `8f3a697a57105d8e9b93c5ce9fe823e46a2d68e4d9ae01879c3e70e55c2a4c77`.
- Live read-only checks: English/Kiswahili pages 200, robots disallow all, API health 200, `/api/me` 503. Staging sends noindex/nofollow and one-day host-only HSTS.

## Proposed production architecture and deployment control

After approval, create an **empty** `production` environment in this same project; do not duplicate staging or its variables. Create a distinct `public-web` service instance only in production, using the existing root Dockerfile. No API, PostgreSQL, volume, shared secret, staging reference or private upstream is required. Confirm staging's configuration ETag and deployment IDs before and after provisioning.

Use one replica, health check `/en/`, port 8080, an initial 0.25 vCPU / 96 MiB runtime limit (validated locally), and Railway HTTPS. The sole official custom domain is `bitsaccojifunze.xyz`. No www or additional custom domains/redirects. Do not generate an additional production Railway public hostname; attach the apex custom domain directly.

Public build argument and runtime variables:

| Setting | Value |
| --- | --- |
| Build argument `SITE_ORIGIN` | `https://bitsaccojifunze.xyz` |
| Runtime `SITE_ORIGIN` | `https://bitsaccojifunze.xyz` |
| `JIFUNZE_HOSTING` | `railway` |
| `JIFUNZE_SITE_MODE` | `static` |
| `PORT` | `8080` |
| Railway environment name | `production` (Railway-provided) |

Do not copy `API_HOST`, API credentials, database variables, `RAILWAY_TRUST_MODEL` or `TRUSTED_PROXY_CIDRS`. No resolver opt-in is needed for static mode. Authentication remains unavailable. Future authenticated production must receive separate architecture and ingress acceptance; the staging trust exception is explicitly rejected here.

After authorized publication, pin the production service's source branch to `release/public-education`, leave auto-deploy disabled and triggers empty, and deploy only the reviewed exact SHA manually. Verify the resulting deployment SHA; never assume a dashboard variable-save uses the intended branch. CI added for the release branch runs checks only and contains no deployment action. Do not modify staging's source, triggers, variables or services.

## Implementation

- The existing Railway NGINX entrypoint gains an explicit static mode. It removes upstream/resolver/proxy directives, returns JSON 404/no-store for `/api` and every `/api/*` route (including health), and applies the existing security headers plus one-day host-only HSTS. It rejects authentication/proxy-trust/API configuration and mismatched environment/origin. Production cannot select the legacy accounts mode.
- The postbuild origin marker prevents static mode from serving an export built for staging. The default production origin was already correct on main.
- The public-origin build hides account navigation and renders a non-interactive English/Kiswahili explanation at all ten account URLs. Existing account components and GitHub/Nostr logic remain intact for staging/local acceptance builds.
- Lightning lab discovery now requires a deliberate check/connect action. Saved pairing credentials do not authorize a fresh document to probe localhost. Pairing, status polling after connection, exercises and disconnect remain available.
- Shared page metadata adds canonical/Open Graph URLs and same-page language alternates. Previously there were no canonical/OG URLs and the layout's alternates pointed every lesson to language homepages. Sitemap already covered the educational routes. Staging noindex behavior remains intact.
- No educational content, approved existing translations, dependencies, authentication API, schema, progress storage model or service-worker policy changed. Account/API data remain excluded from offline caches.

## Browser regression diagnosis

The supplied prior report totals 87 passed / 8 skipped / 13 failed on desktop and 52 passed / 52 skipped / 4 failed on mobile. Its historical raw results are not stored in tracked repository files; the explanations were checked against source and live staging behavior:

| Prior failures | Evidence and correction |
| --- | --- |
| 8 footer cases | All eight language/viewport cases asserted `error_network`. Live staging returns an HTML 503; the account client maps server failures to `error_internal`. Footer geometry now uses a deterministic 503 fixture and asserts the real server-error layout when accounts are available, or the public explanation in an anonymous build. Geometry, legal text and keyboard-link coverage retained. |
| 1 robots case | Staging intentionally disallows indexing, but housekeeping unconditionally required `Sitemap:`. Assertions now require the intended origin's policy and validate every sitemap/alternate origin. |
| 8 localhost cases | Four tests hard-coded port 4321: two no-JS simulation cases, interactive-download recovery and no-JS header navigation. Running both projects produces eight failures against remote targets. They now use the configured base URL; functional assertions retained. |

Playwright accepts `PLAYWRIGHT_BASE_URL` and defaults to a fresh local export server. Remote tests using local asset inspection must use the matching exported artifact. Set `SITE_ORIGIN` to the exported metadata origin when targeting staging; the transport base URL can differ (for example, a local container verifying production metadata). One worker and sequential desktop/mobile runs bound memory. The account CI job explicitly builds with its local acceptance origin so public anonymous pages do not replace its sign-in fixtures.

## Verification record

Verification source: `7a6f74d89289f0d95c06cffecf7102bb3e6e5fd8`. Production Docker export build ID: `YE-i2YF0Ic1LRbAjqfYZC`; local runner image ID `sha256:9a59c1eb80630025bbc734b893120f149f87a20dad9d173a12979ff2fc1d8dd4`. The final browser target is this actual packaged image, not a development server. Its only runtime is NGINX 1.30.6, capped locally at 96 MiB / 0.25 vCPU. The build/check container uses Node 24.22.2 and npm 12.0.2. Native Playwright's harness uses the workstation's Node 24.19.0; it serves no application code. Earlier native-build results are preliminary, not the final artifact acceptance record.

| Check | Result |
| --- | --- |
| Container lint and type checking | Passed |
| Container unit tests | 150 passed, 28 files |
| Container production build | Passed; 110 HTML pages, CSP, internal links and build budgets |
| English/Kiswahili content validation | 0 errors; 69 existing warnings, no content files changed |
| UX JavaScript budgets | Passed; home 143.50/144.9 KB, lesson 146.09/147.3 KB, lab 152.12/153.2 KB gzip |
| Final packaged export audit | 94 indexable pages have canonical/OG URLs and matching language alternatives; 689 packaged files, including NGINX's stock error page |
| Known-secret scan | 3 staging API secret values checked in memory against 682 exported text files; 0 matches; no secret values logged |
| Production NGINX acceptance | 239 checks passed, including API rejection, no cookies, no-store, headers, restart and unsafe configuration refusal |
| Packaged image's normal entrypoint | Passed `nginx -t` with no network, API, database or credentials |
| Existing staging NGINX contract | 97 synthetic Docker checks passed; no live staging authentication enabled |
| Final desktop suite | 105 passed, 8 intentional skips, 0 failures/flaky tests (6.2 minutes) |
| Final mobile suite | 61 passed, 52 intentional skips, 0 failures/flaky tests (3.1 minutes) |

The original 100 KB JavaScript aspiration remains exceeded by the existing React/Next runtime. Existing enforced ceilings and per-page UX budgets pass without relaxation. This is an existing documented stack tradeoff, not a newly achieved 100 KB target.

An initial desktop run passed 103 tests and skipped 8, but two new assertions incorrectly counted the account explanation's language switch as account navigation. DOM evidence showed the remaining link had `hreflang`; the focused correction excludes only language switches and retains the zero-account-navigation assertion. Final suites use that corrected test against the Docker export. Raw local logs are under ignored `.superpowers/public-release/`; failed preliminary results are retained separately from final results.

## Content acceptance and external publication dependency

On 2026-11-05 the maintainer explicitly confirmed: they are the native Kiswahili speaker, reviewer and educator, and all Kiswahili content in this project has been reviewed and is satisfactory. **Kiswahili review is complete.** Preserve the approved wording. Missing `lastReviewed` metadata must not be described as evidence of outstanding Kiswahili review. The repository's two-reviewer policy also calls for technical accuracy sign-off; that sign-off has not yet been identified in the inspected records, so this preparation does not invent it or stamp all lesson dates.

The existing companion-book URL `https://bitsacco.com/kujifunza-bitcoin-sw.pdf` returned HTTP 404 during read-only verification. The upstream [Bitsacco PR #107](https://github.com/bitsacco/bitsacco/pull/107), which adds that PDF, remains OPEN. No upstream repository was modified, no PR was merged and no library content was removed. The maintainer has explicitly made this pending publication non-blocking for the initial release. The library now explains that availability is pending and offers no broken download link. The official English third-edition online fallback and the resolved upstream license history are documented in [the source review](mastering-bitcoin-sources.md). No PDF is copied or generated.

## Cost assessment before provisioning

The actual workspace is **Col Mwanga's Projects**, active **HOBBY**, subscription model USER, not trialing. The read-only billing snapshot showed current usage approximately $0.10 and remaining usage credit $1; those are point-in-time fields, not a production budget or a monthly forecast. The active subscription has a listed $5 base item with quantity 1, usage billing enabled, no scheduled cancellation and no spend commitment. No subscription/payment/usage-limit settings changed.

Railway publishes RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB and persistent volume storage $0.15/GB-month. Hobby has a $5 monthly minimum credited toward combined usage, not a separate $5 fee for each web service. Existing services consume the same allowance. [Railway pricing](https://docs.railway.com/pricing).

Planning estimates for the additional web service (USD/month, before taxes; assumed averages, not measured production demand):

| Scenario | RAM (GB) | CPU (vCPU) | Egress | Estimated resources |
| --- | ---: | ---: | ---: | ---: |
| Small launch | 0.032 | 0.005 | 10 GB | $0.92 |
| Growing audience | 0.064 | 0.02 | 100 GB | $6.04 |
| Heavy traffic | 0.128 | 0.10 | 1,000 GB | $53.28 |

No persistent volume/database is proposed: $0 incremental persistent storage. NGINX's local smoke-test idle usage was about 4.9 MiB, but that is not a production load estimate. At the proposed 96 MiB / 0.25 vCPU limits, continuously saturated compute is about $6/month, plus uncapped egress. The heavy-traffic scenario requires increasing memory beyond the initial cap and separate approval. Bots, repeated downloads and cache misses can raise transfer charges; for scale, 10,000 transfers of 200 KB are roughly 2 GB before other assets. Build-time transient usage and redeploy overlap may add costs. Limits are resource ceilings, not an egress spending cap.

Propose an initial **additional $10/month planning allowance**, subject to explicit maintainer approval and traffic monitoring. It is not a hard billing cap; never add a workspace-wide shutdown rule that could stop staging. A plan upgrade is not proposed.

## Namecheap and remaining approval gates

There is no production service or generated Railway domain record yet. Exact DNS targets and verification TXT values therefore do not exist and must not be invented. After an approved production deployment and custom-domain creation, copy Railway's actual apex target and ownership-verification records into a maintainer-reviewed Namecheap instruction. Use Namecheap's supported apex record type, preserve nameservers and all existing staging CNAME/TXT records, and create no www record. The maintainer performs DNS changes personally. [Railway domain instructions](https://docs.railway.com/networking/domains/working-with-domains).

The maintainer has authorized pushing `release/public-education` and creating a Draft PR for CI and final review. The previous verified baseline is commit `7a6f74d89289f0d95c06cffecf7102bb3e6e5fd8`; the final review report records the updated source and published HEAD. Later documentation-only commits record results without changing the tested application. Do not deploy a different application commit without checking it. Separate explicit approval must cover the additional production spending allowance and creation/deployment of the single isolated production web service. DNS editing remains with the maintainer. After DNS is ready, verify the real domain's certificate, HTTP-to-HTTPS handling, security headers, metadata, API denial, desktop/mobile learning flows and unchanged staging. Local checks cannot establish live public-domain acceptance.


## Final isolation and release decision

The final read-only Railway check found staging's configuration ETag still exactly matched the baseline above. All three deployment IDs, statuses, source commits and domains were unchanged. Live staging learning remained 200, health 200 and accounts 503/no session; no production environment/service exists. No remote writes, allowlist changes, authentication enabling, DNS changes, subscription changes, pushes, merges or deployments were performed.

The actual packaged production container had zero active upstream/resolver/proxy-trust directives and zero backend credential/trust environment variables. English/Kiswahili pages returned 200 without staging noindex headers; production API health and GitHub/Nostr routes returned 404 without cookies. Service-worker cache exclusion, anonymous account pages, local progress transfer, deliberate lab access, simulations, accessibility and navigation passed against this final package. The 60 browser skips are declared viewport/shared-feature exclusions; they are not failures or newly removed coverage. Heavy final checks ran sequentially with one browser worker; no memory exhaustion occurred.

Engineering preparation and local acceptance are complete. Final review may proceed without either book PDF. Technical content acceptance and deployment approval remain maintainer review gates; no production launch acceptance is implied. Kiswahili content approval is already complete and is not an outstanding gate. Draft PR publication is authorized. Production spending/provisioning/deployment authorization, maintainer DNS configuration and subsequent real-domain HTTPS/live acceptance remain. GitHub/Nostr staging acceptance is deliberately not a launch prerequisite for this static release.
