# Staging operations

Verified 13 November 2026 (Africa/Nairobi). Staging is separate from [production](production.md); it is not an account-release environment for learners.

## Current state

| Item | Verified state |
| --- | --- |
| Project / environment | `bitsacco-jifunze` / `staging` (`1b138f86-2127-4c52-9142-868ecdf75460`) |
| Public origin | <https://staging.bitsaccojifunze.xyz>; noindex/nofollow, robots disallow all |
| Web | `27e66b05-93b9-4180-bb8e-263052e4e69c` / `80c7f5ad4599574eb37a5165f9866d90260ed812`, SUCCESS |
| API | `54f04926-aa26-4f44-8e31-099ad715b4e8` / `b702a14`, SUCCESS; unused by the site |
| PostgreSQL | `f8ac6eaf-5174-4157-9064-8304c295fe4e`, SUCCESS; unchanged |
| Networking | Only web has HTTP domains; API/database private; zero public TCP proxies |
| Capacity / deployment control | One replica per service; web/API auto-deploy disabled; no repository triggers |
| Account access | Tester allowlist enforced and empty; no learner can authenticate |
| API forwarding | Web `STAGING_AUTH_ENABLED=1` remains set; the account-free site makes no account API request |

The plain English/Kiswahili feedback link passed 12 live desktop/mobile Chromium checks on this exact web commit, including keyboard activation, no-JavaScript operation and the absence of copy controls/helper text. The earlier reviewed account-free build also passed progress/import-order, offline, navigation and retired-route acceptance. These results are tied to their commits, not a promise about a future build.

## Controlled web deployment

1. Verify the exact PR head and its CI, configuration ETag, service IDs, deployments, limits, domains, trigger settings and redacted variable comparison. Confirm the previous accepted web image is rollback-eligible.
2. Deploy only the approved service and full SHA through `serviceInstanceDeployV2`. Both services retain `deploy/railway-staging` as their configured source branch, so a branch label is insufficient evidence: inspect the deployment's actual `meta.commitHash`.
3. Verify HTTPS, noindex/robots, feedback, local progress and the relevant regression cases. Retired account paths must return the ordinary 404 in both languages.
4. Recheck the private services, allowlist, configuration and production baseline. Do not change the API/database, billing, DNS or production as a side effect of web deployment.

The previous web `ec9d7693-9d02-4267-85bf-c57ed0f99f3d` / `9923f6e` was rollback-eligible at the latest staging acceptance. Recheck eligibility before a later operation.

## Unused API and ingress boundary

The application does not need API forwarding. The smallest pending change is to set only staging web `STAGING_AUTH_ENABLED=0` with deployment suppressed, then redeploy the same reviewed web SHA. After that change, protected `/api/*` routes should return 503/no-store, `/api/health` should stay 200, internal routes should stay 404 and learning/feedback must still work. This recommendation has not been applied. Removing services or database records is a separate cleanup decision.

The retained `RAILWAY_TRUST_MODEL=isolated-staging` configuration trusts all workloads/operators in this isolated environment; it does not authenticate Railway's edge with a verified exclusive CIDR. NGINX validates/canonicalizes the supplied client address and forwarded protocol, strips client forwarding lists and preserves the API's limiter behavior. A compromised private co-tenant can still forge a valid address. Do not introduce an untrusted workload or treat this model as production authentication approval.

The canonical-host gate refuses account API access on the generated Railway hostname. Internal tester-gate routes remain hidden. The empty enforced allowlist prevents authentication even though forwarding remains enabled. Current API maintenance and logging requirements are in [Retained API](../development/retained-api.md).

No signer/provider interoperability, authenticated production release, durable off-service account backup or account privacy/legal approval follows from anonymous site acceptance. The retired account interface is not available, regardless of origin or build flag.
