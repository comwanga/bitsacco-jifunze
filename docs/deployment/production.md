# Production operations

Recorded after live acceptance on 2026-11-06 for release [`39fa78a34deece8f3ed6eedd162725557de9829e`](https://github.com/comwanga/bitsacco-jifunze/commit/39fa78a34deece8f3ed6eedd162725557de9829e). Recheck Railway before operational changes; this is a dated deployment record, not continuous monitoring.

## Running service

| Item | Accepted configuration |
| --- | --- |
| Public website | <https://bitsaccojifunze.xyz> (apex only; no www) |
| Railway project | `bitsacco-jifunze` / `9a7612e6-649f-44ca-91db-45977f0a8c41` |
| Environment | `production` / `efc4e6ac-67f5-4e98-bffa-89095e2ef0d0` |
| Service | `public-web` / `f2834873-d0f4-4248-aa52-ba5db5625a53` |
| Accepted deployment | `c64a885a-18bd-41bc-aa3b-be8b8447d4f0` |
| Source | `comwanga/bitsacco-jifunze`, `main`, exact release SHA above |
| Build/runtime | Root [Dockerfile](../../Dockerfile); Next.js static export served by non-root NGINX |
| Capacity | One replica, 0.25 vCPU, 96 MiB (100,663,296 bytes), SFO region |
| Port / startup health | `8080` / `/en/` |
| Deployment control | Automatic deployment disabled; no repository triggers |

Production has no API, database, persistent volume, application secrets or shared environment variables. Public learning has no account, invitation or learner-count limit. The Lightning lab runs in the learner's own environment, not on Railway.

The only configured application variables are:

```text
SITE_ORIGIN=https://bitsaccojifunze.xyz
JIFUNZE_HOSTING=railway
JIFUNZE_SITE_MODE=static
PORT=8080
```

Railway supplies the environment name `production`. Supply `SITE_ORIGIN` to both the Docker build argument and runtime; the build records its origin. The [entrypoint](../../docker/railway-entrypoint.sh) rejects an origin/export/environment mismatch, account mode and backend/proxy-trust settings. Do not copy `API_HOST`, database/OAuth/tester variables, `RAILWAY_TRUST_MODEL` or `TRUSTED_PROXY_CIDRS` into production. Every `/api` route returns 404/no-store without a session cookie. Future authenticated production needs a separate security review; the isolated-staging trust exception does not apply.

## Controlled deployment and rollback

1. Obtain approval for the exact reviewed commit and any resource/configuration change. Check that its GitHub CI passed; a green branch name is insufficient.
2. Save production deployment/source/settings/domain state and a redacted [staging baseline](railway-staging.md). Scope every action to the production environment and `public-web`; never clone staging or copy its variables.
3. Keep automatic deployments disabled. Use Railway's existing GitHub source integration and an exact-commit deployment (`serviceInstanceDeployV2` with the production service ID, environment ID and approved `commitSha`, or a dashboard action that can select that exact commit). Inspect staged changes before applying them. If the integration cannot fetch that SHA, stop; do not substitute a revision or upload another checkout.
4. Confirm Railway's actual fetched/deployed SHA, Docker build, NGINX startup and `/en/` health. Retain the four public variables and approved limits. Do not create another service or public hostname. A service creation method that spans all environments must not be used: the initial service was created with an environment-scoped changeset.
5. Check the real HTTPS site, both languages, canonical/sitemap origins, security headers, `/api` rejection/no cookies, navigation, offline/progress, PDFs and accessibility. For browser checks against a remote target, use the matching deployed export for asset/budget inspection; do not substitute an unrelated local build. Compare staging afterward.

On a failed source fetch/build, wrong SHA, unsafe variables or failed health check, stop the affected production deployment and retain logs. For API/session exposure, stop production immediately; detach only its domain if needed to prevent exposure. Never route traffic to staging. For later releases, restore the retained previously accepted production image/configuration and reverify SHA, origin, health and API isolation. The first release had no prior production deployment; image availability must be checked before relying on rollback. Do not change staging or rewrite Git history.

## Domain and HTTPS

The maintainer added these Namecheap records; nameservers, mail and staging records were preserved:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| ALIAS | `@` | `xhtl8e9c.up.railway.app` | 5 minutes |
| TXT | `_railway-verify` | Railway ownership value for this production custom domain | 5 minutes |

Retrieve the exact ownership value from Railway if repairing DNS; do not invent or replace it. The ALIAS target is a hostname, not a promised static IP. Production custom-domain ID: `a6d0a82f-f1ae-4fef-84f9-5f68c0efb6d8`, port 8080. Acceptance recorded ACTIVE, ownership verified and DNS PROPAGATED. Independently validated TLS covered the apex; HTTP redirected to matching HTTPS. Railway manages the certificate; continue checking expiry and HTTPS rather than assuming renewal succeeded.

For DNS/TLS failures, compare actual public resolution and Railway's record/certificate status. Do not bypass TLS validation, change nameservers or replace ALIAS with an apex CNAME that conflicts with mail. Any DNS rollback needs maintainer approval and affects only the production ALIAS and its ownership TXT. Preserve the previous zone records; never restore a partial public-DNS snapshot as an entire zone.

## Monitoring and scaling

Use `production` → `public-web` → Metrics and deployment logs. Railway exposes [CPU, memory, disk and network metrics](https://docs.railway.com/observability/metrics); these do not establish application latency/error-rate monitoring. Check valid HTTPS responses from `/en/` and `/sw/`, logs and resource use daily during initial operation and after busy periods. Review billed usage/egress daily for the first week. Startup health is not continuous uptime monitoring.

At acceptance, no custom notification rules or external uptime monitor were configured; email/in-app delivery was not verified enabled. Inspect supported account notification channels before proposing alerts. Do not claim Lighthouse scores, physical-device Safari certification or continuous availability from the browser results below.

The existing Hobby plan bills actual usage; no separate $10 allocation or workspace-wide spending-limit change was approved. On 2026-11-06 at 20:28 UTC, production had accrued approximately $0.015 including verification traffic; sampled peak RAM was 60.51 MiB and CPU usage 0.007992 vCPU, within the limits. These are historical samples, not a forecast or spending cap. Consult [current pricing](https://docs.railway.com/pricing) before any cost decision; repeated 9.1 MB book downloads can materially increase egress.

If sustained CPU saturation causes slow responses, investigate before proposing 0.5 vCPU. If repeated memory pressure/OOMs occur, propose the smallest justified increase (for example 128 MiB). More replicas need evidence and approval; extra CPU/RAM does not reduce egress charges. Record the time window, affected routes, resource trend, response timings and expected cost. Do not scale automatically, upgrade the plan or set workspace-wide shutdown controls that could stop staging.

## Recorded live acceptance and remaining gate

The post-merge [CI run](https://github.com/comwanga/bitsacco-jifunze/actions/runs/42246086439) passed frontend, account and lab jobs against the release SHA. On the official HTTPS origin, using the matching deployed export, existing Playwright suites recorded:

| Suite | Passed | Expected skips |
| --- | ---: | ---: |
| Desktop Chromium | 125 | 8 |
| Mobile Chromium emulation | 73 | 52 |
| WebKit table matrix | 8 | 0 |

There were zero final failures. An earlier mobile attempt failed DNS resolution before application assertions; it was retained separately and the unchanged complete run passed after normal DNS recovered. All 96 sitemap pages returned 200 with matching deployed HTML, production canonical/Open Graph/language metadata and no session cookies. HTTPS, headers, API denial, bilingual learning, quizzes, trees, simulations, local progress/export/import, offline lessons, keyboard table scrolling and tested Axe assertions passed. The three advertised PDFs opened/downloaded on desktop/mobile emulation with matching checksums. These results are not physical-device certification, PDF/UA certification, a Lighthouse score or a new full external-link audit.

The English *Mastering Bitcoin* PDF remains 9,112,090 bytes, 406 pages, SHA-256 `aedbf60fc15e199903d3bfede1268dae4aa75922f764fb44b1d400eb0d255511`; see [provenance and reproduction](mastering-bitcoin-generated.md). It loads on request and is excluded from lesson caches. The Kiswahili book remains pending publication, with no active download. Staging's ETag, service deployments, variables, source settings and domains matched the pre-provisioning baseline after acceptance.

The detailed operator evidence is retained locally under ignored `.superpowers/production-execution/` (`LIVE-ACCEPTANCE.md`, `acceptance-summary.json`, browser logs and configuration/DNS comparisons); it is not needed to build the repository and is not claimed available to a fresh clone. This section preserves its essential release identifiers, outcomes and limitations.

The website is publicly accessible. Maintainer Kiswahili review is complete. **Independent human technical-content sign-off remains outstanding before a public-launch announcement.** Automated checks do not supply the two-reviewer approval required by [CONTRIBUTING.md](../../CONTRIBUTING.md#reviewers).
