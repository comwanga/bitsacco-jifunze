# Production operations

Verified 13 November 2026 (Africa/Nairobi). Deployment and CI timestamps use UTC. These are point-in-time observations; recheck Railway before a later release.

## Running service

| Item | Verified state |
| --- | --- |
| Public origin | <https://bitsaccojifunze.xyz> (apex only) |
| Railway project | `bitsacco-jifunze` / `9a7612e6-649f-44ca-91db-45977f0a8c41` |
| Environment | `production` / `efc4e6ac-67f5-4e98-bffa-89095e2ef0d0` |
| Service | `public-web` / `f2834873-d0f4-4248-aa52-ba5db5625a53` |
| Deployed commit | `078807ca96914cca67379ff46e9b1aef88ea1d5a`, merge of [PR #26](https://github.com/comwanga/bitsacco-jifunze/pull/26) |
| Deployment | `6fc46ae1-dd08-4e33-8663-278fcf44de0e`, SUCCESS |
| Image | `sha256:4b47d6de74bf8a1240c5bd71f10a530fafeffb8f622774a2f3d2b5a5e867866d` |
| Previous deployment | `04b97643-9ff7-45dd-ab39-433c68a2437b` / `3ec6b0d`; rollback-eligible before and after this release |
| Runtime | Root Dockerfile; Next.js static export; non-root NGINX |
| Capacity | One SFO replica, 0.25 vCPU, 96 MiB |
| Port / startup health | `8080` / `/en/` |
| Deployment control | Automatic deployment disabled; zero repository triggers |

Production is account-free and has no API, database, persistent volume, application secret or shared environment variable. All `/api` and `/api/*` routes, including health, return 404/no-store without a session cookie. The Lightning lab runs in the learner's environment.

## Configuration

The application variables are:

```text
SITE_ORIGIN=https://bitsaccojifunze.xyz
JIFUNZE_HOSTING=railway
JIFUNZE_SITE_MODE=static
PORT=8080
```

Railway supplies the `production` environment name. Feedback uses the application's public default recipient, `mwanga@bitsacco.com`; an optional `JIFUNZE_FEEDBACK_EMAIL` override is a build-time public value requiring a rebuild. See [Feedback](../development/feedback.md).

The existing entrypoint rejects API/proxy-trust settings, an incorrect production origin, the account site mode and an export-origin mismatch. Supply `SITE_ORIGIN` at both build and runtime. Do not copy staging variables or services into production.

## Deployment and rollback

1. Confirm approval for the intended release and a successful CI run on its exact SHA. The current release passed [CI run 43315504797](https://github.com/comwanga/bitsacco-jifunze/actions/runs/43315504797) (`check`, `account`, `lab`).
2. Capture the production service/configuration, public variables, limits, domains, active deployment and rollback eligibility. Capture the [staging baseline](railway-staging.md) separately. Do not log raw secret values.
3. Keep automatic deployment off. Use `serviceInstanceDeployV2` with the production environment/service IDs above and the full reviewed `commitSha`. A source branch label or stored source-configuration SHA is not proof of the fetched commit; the existing configuration can retain an older pin. Do not substitute a checkout or update unrelated settings.
4. Confirm the deployment's actual `meta.commitHash`, image digest, successful NGINX startup and health. Retain the existing origin, static mode, domain and capacity.
5. Verify both languages, canonical/sitemap/robots metadata, HTTPS and CSP/security headers, API rejection/no cookies, feedback, quizzes, progress import/export, offline reading and accessibility. Tests that inspect asset sizes must use the actual deployed export; do not call an unrelated local build a production measurement.
6. Compare production settings and the complete staging baseline afterward. Record the exact result in this guide.

Before relying on rollback, recheck `canRollback` for the previous successful deployment and retain its SHA/image identity. On failed health, a wrong SHA or API/session exposure, stop the affected rollout and restore the retained accepted production image/configuration, then repeat origin, health and API-isolation checks. Never direct production traffic to staging. Rollback eligibility is a point-in-time provider observation, not a future guarantee.

Ordinary source deployments do not require DNS changes. Preserve the apex ALIAS/verification records, nameservers, mail and staging records. Diagnose DNS/TLS failures against Railway's current domain status; do not bypass certificate validation or create another public hostname as a workaround.

## Live acceptance

The owner authorized this production deployment on 13 November 2026. Live Chromium checks on the official HTTPS origin passed **36 cases**, with **two declared mobile skips** for shared static-metadata/service-worker cases already covered on desktop. Coverage includes English/Kiswahili feedback as a single mailto link, keyboard/no-JavaScript use, responsive layout and axe scans, quizzes, stale-tab progress, export/import and quiz import order, offline reloads, retired account routes and deliberate-only local-lab contact.

All 130 sitemap pages returned 200 with production canonical URLs, indexable metadata, security headers, the strict page CSP and no session cookies or account/copy controls. The 20 HTTP acceptance checks also verified robots/sitemap behavior, HTTP-to-HTTPS redirection, API rejection/no-store, all ten retired account URLs, and the English book's MIME, 9,112,090-byte length and source-manifest SHA-256. Performance budgets belong to the successful exact-commit CI build; no live production performance score is inferred from functional browser checks. Phone coverage is device emulation, not physical-device or screen-reader certification.

The public variables, limits, domain, deployment controls and staging services were preserved. Raw operator evidence remains locally under ignored `.superpowers/production-release-2026-11-13/`; a fresh clone does not require those files to build the site.

## Operations

Use Railway metrics and logs for the `production` / `public-web` instance. The `/en/` startup health check is not continuous external monitoring. External uptime monitoring was not configured at this release; the owner previously accepted that operational limitation.

Investigate measured resource pressure before proposing capacity changes. CPU/RAM changes, extra replicas, plan changes and DNS changes need their own authorization. Existing limits do not constitute an egress spending cap; consult current provider pricing before a cost decision.

The [content guide](../content-guide.md#review-status) records the owner's curriculum review and waived independent reviews without inventing formal sign-offs. The Kiswahili book remains pending publication. [PDF provenance](mastering-bitcoin-generated.md) documents the currently published English edition.
