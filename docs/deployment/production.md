# Production operations

Verified 21 November 2026 (Africa/Nairobi). Deployment and CI timestamps use UTC. These are point-in-time observations; recheck Railway before a later release.

## Running service

| Item | Verified state |
| --- | --- |
| Public origin | <https://bitsaccojifunze.xyz> (apex only) |
| Railway project | `bitsacco-jifunze` / `9a7612e6-649f-44ca-91db-45977f0a8c41` |
| Environment | `production` / `efc4e6ac-67f5-4e98-bffa-89095e2ef0d0` |
| Service | `public-web` / `f2834873-d0f4-4248-aa52-ba5db5625a53` |
| Deployed commit | `af59d52fb5d46efc04dd9c7f472b9314ffc8b405`, merge of [PR #30](https://github.com/comwanga/bitsacco-jifunze/pull/30), on top of [PR #31](https://github.com/comwanga/bitsacco-jifunze/pull/31) |
| Deployment | `23dd6926-2a2d-4c1e-9cab-164bc8880c7e`, SUCCESS |
| Image | `sha256:00ac0106bf210723659452ac48578a972768bba04ccd4a82c8b0612de5877d7e` |
| Previous deployment | `57eb7df9-1a4f-477c-99a3-38601b4801bd` / `b02ead0` (image `sha256:9db25b6739c6c5150c12503abb0ed767fd17e622273f94834402163bdc16af02`); rollback-eligible before and after this release |
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

1. Confirm approval for the intended release and a successful CI run on its exact SHA. The current release passed [CI run 44911643603](https://github.com/comwanga/bitsacco-jifunze/actions/runs/44911643603) (`check`, `account`, `lab`).
2. Capture the production service/configuration, public variables, limits, domains, active deployment and rollback eligibility. Capture the [staging baseline](railway-staging.md) separately. Do not log raw secret values.
3. Keep automatic deployment off. Use `serviceInstanceDeployV2` with the production environment/service IDs above and the full reviewed `commitSha`. A source branch label or stored source-configuration SHA is not proof of the fetched commit; the existing configuration can retain an older pin. Do not substitute a checkout or update unrelated settings.
4. Confirm the deployment's actual `meta.commitHash`, image digest, successful NGINX startup and health. Retain the existing origin, static mode, domain and capacity.
5. Verify both languages, canonical/sitemap/robots metadata, HTTPS and CSP/security headers, API rejection/no cookies, feedback, quizzes, progress import/export, offline reading and accessibility. Tests that inspect asset sizes must use the actual deployed export; do not call an unrelated local build a production measurement.
6. Compare production settings and the complete staging baseline afterward. Record the exact result in this guide.

Before relying on rollback, recheck `canRollback` for the previous successful deployment and retain its SHA/image identity. On failed health, a wrong SHA or API/session exposure, stop the affected rollout and restore the retained accepted production image/configuration, then repeat origin, health and API-isolation checks. Never direct production traffic to staging. Rollback eligibility is a point-in-time provider observation, not a future guarantee.

Ordinary source deployments do not require DNS changes. Preserve the apex ALIAS/verification records, nameservers, mail and staging records. Diagnose DNS/TLS failures against Railway's current domain status; do not bypass certificate validation or create another public hostname as a workaround.

## Live acceptance

The owner authorized this production deployment on 21 November 2026. [PR #30](https://github.com/comwanga/bitsacco-jifunze/pull/30) replaces the baobab install icons with the Bitsacco mark from the site header: 192 and 512 icons, a padded maskable 512 icon, a 180 Apple touch icon and a `#1b2550` splash background. [PR #31](https://github.com/comwanga/bitsacco-jifunze/pull/31) updates Next.js to 16.4.6 for the advisories that had been failing the CI dependency audit. Live Chromium checks on the official HTTPS origin passed **65 cases**, with **five declared skips**, using the same seven specs on desktop and mobile as the previous release: learning UX and the welcome scene, feedback, public release, progress tabs, quizzes, housekeeping/offline and smoke. Accessibility scans in this live run covered the Continue Learning card, the feedback block and full pages in the header feedback check; the full axe suite ran in the exact-commit CI build.

The live manifest lists only the new icons, with `background_color` `#1b2550`. All four icons return `image/png` with `no-cache` and are byte-identical to the merged files; the three baobab icon URLs return 404. Both language home pages link `/icons/jifunze-apple-touch-180.png` and keep the `/logo.svg` favicon. Chromium reported no manifest or installability errors, and the service worker precached `/icons/jifunze-192.png`. Installed apps on physical Android, iOS and desktop devices were not checked; existing iOS home-screen icons change only after the app is added again.

All 130 sitemap pages returned 200 with production canonical URLs (the `/tree/` aliases point to the standard path URL and are not listed), indexable metadata, security headers, the strict page CSP and no session cookies or account/copy controls. The 20 HTTP acceptance checks also verified robots/sitemap behavior, HTTP-to-HTTPS redirection, API rejection/no-store, all ten retired account URLs, and the English book's MIME, 9,112,090-byte length and source-manifest SHA-256. Performance budgets belong to the successful exact-commit CI build; no live production performance score is inferred from functional browser checks. Phone coverage is device emulation, not physical-device or screen-reader certification.

The public variables, limits, domain and deployment controls were preserved, checked before and after the deployment. Staging was read after the release and still matches the [staging guide](railway-staging.md); it was not captured before the deployment. Raw operator evidence remains locally under ignored `.superpowers/production-release-2026-11-21-pr30/`; a fresh clone does not require those files to build the site.

## Operations

Use Railway metrics and logs for the `production` / `public-web` instance. The `/en/` startup health check is not continuous external monitoring. External uptime monitoring was not configured at this release; the owner previously accepted that operational limitation.

Investigate measured resource pressure before proposing capacity changes. CPU/RAM changes, extra replicas, plan changes and DNS changes need their own authorization. Existing limits do not constitute an egress spending cap; consult current provider pricing before a cost decision.

The [content guide](../content-guide.md#review-status) records the owner's curriculum review and waived independent reviews without inventing formal sign-offs. The Kiswahili book remains pending publication. [PDF provenance](mastering-bitcoin-generated.md) documents the currently published English edition.
