# Staging operations

Service deployments and web domains verified 26 November 2026 (Africa/Nairobi); networking, capacity, allowlist and variable rows were last verified 13 November 2026. Staging is separate from [production](production.md); it is not an account-release environment for learners.

## Current state

| Item | Verified state |
| --- | --- |
| Project / environment | `bitsacco-jifunze` / `staging` (`1b138f86-2127-4c52-9142-868ecdf75460`) |
| Public origin | <https://staging.bitsaccojifunze.xyz>; noindex/nofollow, robots disallow all |
| Web | `408c92b1-7bf9-419b-bf7e-f5d63b8f195d` / `36be54cce6dd2efb40e6652accb59152c45c4dc4` (merge of [PR #34](https://github.com/comwanga/bitsacco-jifunze/pull/34)), SUCCESS |
| API | `54f04926-aa26-4f44-8e31-099ad715b4e8` / `b702a14`, SUCCESS; unused by the site |
| PostgreSQL | `f8ac6eaf-5174-4157-9064-8304c295fe4e`, SUCCESS; unchanged |
| Networking | Only web has HTTP domains; API/database private; zero public TCP proxies |
| Capacity / deployment control | One replica per service; web/API auto-deploy disabled; no repository triggers |
| Account access | Tester allowlist enforced and empty; no learner can authenticate |
| API forwarding | Web `STAGING_AUTH_ENABLED=1` remains set; the account-free site makes no account API request |

This web commit passed 137 live desktop/mobile Chromium checks on the staging origin: home, world map, not-found, smoke, public release, accessibility, library, book reader, catalogue and lesson specs. The two failures were the English book test's production-canonical assertion, which staging's own canonical origin fails by design; the Kiswahili book test covers the same reader flow and passed. Direct checks confirmed HTTPS with an HTTP redirect, `noindex, nofollow` on every response, robots disallowing all, ordinary 404s for retired account paths in both languages, and both PDFs served as `application/pdf` with byte ranges and the exact bytes in their manifests. These results are tied to this commit, not a promise about a future build.

## Controlled web deployment

1. Verify the exact PR head and its CI, configuration ETag, service IDs, deployments, limits, domains, trigger settings and redacted variable comparison. Confirm the previous accepted web image is rollback-eligible.
2. Deploy only the approved service and full SHA through `serviceInstanceDeployV2`. Both services retain `deploy/railway-staging` as their configured source branch, so a branch label is insufficient evidence: inspect the deployment's actual `meta.commitHash`.
3. Verify HTTPS, noindex/robots, feedback, local progress and the relevant regression cases. Retired account paths must return the ordinary 404 in both languages.
4. Recheck the private services, allowlist, configuration and production baseline. Do not change the API/database, billing, DNS or production as a side effect of web deployment.

The previous web `957decab-a0ae-4970-ba38-96296069ae53` / `5a1c9fe` was rollback-eligible before this deployment. Recheck eligibility before a later operation.

## Unused API and ingress boundary

The application does not need API forwarding. The smallest pending change is to set only staging web `STAGING_AUTH_ENABLED=0` with deployment suppressed, then redeploy the same reviewed web SHA. After that change, protected `/api/*` routes should return 503/no-store, `/api/health` should stay 200, internal routes should stay 404 and learning/feedback must still work. This recommendation has not been applied. Removing services or database records is a separate cleanup decision.

The retained `RAILWAY_TRUST_MODEL=isolated-staging` configuration trusts all workloads/operators in this isolated environment; it does not authenticate Railway's edge with a verified exclusive CIDR. NGINX validates/canonicalizes the supplied client address and forwarded protocol, strips client forwarding lists and preserves the API's limiter behavior. A compromised private co-tenant can still forge a valid address. Do not introduce an untrusted workload or treat this model as production authentication approval.

The canonical-host gate refuses account API access on the generated Railway hostname. Internal tester-gate routes remain hidden. The empty enforced allowlist prevents authentication even though forwarding remains enabled. Current API maintenance and logging requirements are in [Retained API](../development/retained-api.md).

No signer/provider interoperability, authenticated production release, durable off-service account backup or account privacy/legal approval follows from anonymous site acceptance. The retired account interface is not available, regardless of origin or build flag.
