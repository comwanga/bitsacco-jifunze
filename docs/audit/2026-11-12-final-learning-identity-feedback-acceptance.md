# Final learning identity, feedback and staging acceptance

Recorded 2026-11-12. Branch: `feat/learning-identity`. The [earlier learning-identity report](2026-11-12-learning-identity.md) is historical implementation evidence. The results below were executed for this final integration; they are not copied-forward acceptance claims.

## Implementation and owner review

The preserved learning-identity implementation is SSH-signed commit **`f3bf8f2abc58ef7ac3141520e370dd72b3f4db97`**. Feedback is the separate SSH-signed commit **`196825267cd8d6f938b218fb7ad6128e990c8859`**; its account-test input assertion correction is **`34bead79080909d0295e1b19c5def3a6aa823d8f`**. All signatures verified using the repository's existing SSH trust configuration; preceding signed history was not rewritten. The final review/acceptance record is committed separately. No push, PR, merge or deployment was performed.

The built-in signer remains the default. Key storage/proofs, authenticated sessions, PostgreSQL progress, account expectations, recovery rotation, anonymous/offline learning and advanced signer compatibility were preserved. No new auth model, API endpoint, database migration, dependency, analytics or Nostr messaging was introduced.

`Send Feedback` / `Tuma Maoni` appears in the shared footer and as a contextual text link beside lesson/path navigation. It is a server-rendered `mailto:` link, not a mail-sending service. `JIFUNZE_FEEDBACK_EMAIL` is a **public build-time** recipient (default defined once); Docker and Compose accept it as a build argument. Context is restricted to public curriculum titles and canonical paths, never query/fragment, progress, account identifiers, keys, recovery codes or sessions. The native disclosure exposes a selectable read-only address without JavaScript or clipboard permission. The owner approved this implementation scope. [Configuration and behavior](../development/feedback.md).

The owner confirmed completed Kiswahili review of learning identity/account experience **on 2026-11-12**, and expressly asked that the actual review date remain **unspecified**. Terminology records use `confirmationDate: 2026-11-12`, `reviewDate: null`; earlier approved dates were preserved. Exact feedback action labels were explicitly supplied by the owner. Newly written copy/privacy instructions and the separately scoped advanced-signer terminology remain flagged rather than being automatically treated as approved. No additional reviewer identity or independent specialist approval is asserted.

## Focused security and privacy findings

The separate [security/privacy review](2026-11-12-learning-identity-privacy-review.md) records evidence, data inventory, retention, deletion and external-review requirements. No demonstrated auth/backend defect requiring an additional correction was found. Browser testing did correct the feedback disclosure's accessibility role. A staging-only layout assertion was updated to require the approved Save Progress default and absence of an external-signer control before opening advanced options; no test or budget was weakened.

IndexedDB is browser-readable application storage, not protection against malicious same-origin scripts, compromised devices or profile backups. Recovery codes recover access and server-saved progress; they do not reconstruct the original private key, recover unsynchronized lost-device work or undo compromise/deletion. Default sign-out removal is important on shared devices; retained local work/key material is not confidential between people sharing that profile. The identity remains dedicated to education, never Bitcoin funds or a primary Nostr identity.

Privacy release gates include a learner-facing notice/rights process, defined account/mail retention, verified platform/edge log retention, backup/restore and access-role/data-location evidence, processor/cross-border arrangements and qualified Kenyan privacy-law review. SQL account deletion cascades account-owned records; disassociated security events remain until the existing 90-day purge, and locally retained/exported/backup copies have separate lifecycles. No legal compliance, external audit certification or physical-device certification is claimed.

## Fresh read-only staging preflight

Observed through authenticated Railway metadata at **17:26 UTC**, rollback metadata at **17:33 UTC**, and isolated browser sessions on the real staging hostname. A final **17:46 UTC** metadata recheck matched the initial redacted snapshot exactly, including staging/production configuration ETags, deployment IDs and tester-list digests. Private read-only aggregate SQL was refreshed at **18:01:55 UTC**, also confirming the running API's tester-list counts/validity; live anonymous browser checks were repeated at 17:46 UTC. Restricted-shell access initially appeared unauthenticated; access through the existing protected local Railway login succeeded. No new login credentials, SSH keys, public database tunnel or services were created.

| Check | Current evidence |
| --- | --- |
| Project/environment | `bitsacco-jifunze` / `staging`; environment `1b138f86-2127-4c52-9142-868ecdf75460` |
| Separation | Exactly staging web/API/PostgreSQL; only web has public domains/configured networking. API database connection uses a Railway private domain, verified again inside the API container with staging service/environment guards. Production is a separate environment containing only `public-web`. |
| Deployed source | Both staging web/API report `a480c762cbbc91360274d5ec19a7e5a64467b423`, branch `deploy/railway-staging`; the new identity/feedback commits are **not deployed**. Web deployment `5da76575-a7c2-4d94-8b4b-73d904112fbf`; API `96c450ad-1eb3-462f-a607-e1b474f48efa`; both SUCCESS. |
| Tester gate | `STAGING_AUTH_ENABLED=1`, trust `isolated-staging`; **0 GitHub / 0 Nostr testers** in valid lists, verified in both Railway configuration and the running API's environment. The empty list denies authentication; it was not populated or weakened. This supersedes the older authentication-off record. |
| Fresh aggregate counts | **0 accounts, 0 identities, 0 sessions, 0 progress rows, 0 recovery-code rows**. SQL ran in `BEGIN READ ONLY`; no account rows/keys/codes/connection strings were printed. |
| Deployment triggers | Automatic deployment off for staging web/API; no repository triggers. |
| Rollback | Railway reports current web/API and prior `00fa0f04` deployments eligible (`canRollback=true`). Prior targets: web `32eff7c2-e56c-4f62-9058-6d294edafda7`; API `ca404d36-5b6c-48e5-aa70-247065f80fd2`. Image digests were captured in redacted evidence. Eligibility inspected only; no rollback/restore was executed. |
| Public checks | Staging home/robots 200 with noindex; health 200, `/api/me` 401, no-store on API and no issued session cookies. Real browser anonymous lesson completion saved locally in **both languages with zero account requests**. Current staging has neither the new Save Progress control nor feedback links. |
| Production | Only `public-web`, SUCCESS deployment `04b97643-9ff7-45dd-ab39-433c68a2437b`, source `3ec6b0d077811eefacc0ebf43595b916e4449040`; no production API/database. No production mutation was made. |

Read-only evidence is stored locally under `.superpowers/final-staging-*.json`, with only allowlisted metadata/counts persisted. Raw variables and deployment metadata were never written to those reports. [Updated staging safeguards](../deployment/railway-staging.md).

## Acceptance scenarios

| Scenario | Local real-browser/API verification | Actual staging |
| --- | --- | --- |
| 1. Anonymous starts learning | Preserved and tested | **Passed:** English/Kiswahili lesson completion persisted locally, zero account requests |
| 2–5. Save → identity → recovery backup → server sync | Device/learner/account suites | **Blocked:** new frontend not deployed; existing allowlist empty |
| 6. Returning learner | Existing/expired-session tests | **Blocked:** no authorized test account |
| 7–8. New browser/device and code recovery | Fresh browser and explicit storage/cookie clearing tests | **Blocked:** no authorized test identity/codes |
| 9. Offline work syncs after reconnect | Existing account sync browser checks | **Blocked** for account sync; anonymous reading alone is not this acceptance |
| 10–11. Shared-device isolation / credential removal | Device/account ownership and stale-tab regression checks | **Blocked:** no authorized account identities |
| 12. Account deletion | API/learner lifecycle tests | **Blocked:** no test account; no deletion attempted in staging |
| 13. Feedback without sign-in | Mailto, no-script, keyboard, fallback, privacy and accessibility checks | **Blocked:** feedback not deployed; no email was sent |
| 14. Language consistency | Both-language local checks | Anonymous completion observed in both; new account/feedback flows remain **pending** |

**Authenticated staging acceptance is not claimed.** Required next actions are explicit authorization to publish/deploy the reviewed signed frontend through the controlled staging source workflow and to enroll only approved generated public keys in the **existing** allowlist. Preserve all other entries, verify the exact API/source/boot counts after any authorized configuration redeployment, keep API/database private, and exercise the 14 scenarios with temporary approved learners and cleanup. Authentication is already enabled; no flag change is implied. No public signup, variable edit, allowlist edit, service activation, push or deployment is authorized by this report.

## New verification results

Executed locally on 2026-11-12 against this implementation, with fresh throwaway PostgreSQL databases and the real API. These are separate from historical checks and actual Railway acceptance.

| Gate | New result |
| --- | --- |
| Frontend unit tests | `npm test -- --maxWorkers=2`: **247 passed / 42 files** |
| PostgreSQL/API tests | `npm run api:test`: **332 passed / 12 files**; `api:typecheck` passed |
| Lint/types/content | ESLint and frontend `typecheck` passed; content validation **0 errors / 101 existing warnings** |
| Public browser regression | All 316 cases executed across the focused feedback/footer run and remaining general specs: **254 passed / 62 existing project skips / 0 failures**; includes Chromium desktop/mobile, WebKit lesson tables, axe, keyboard, layout, performance, anonymous learning, no-script feedback and service-worker checks |
| Feedback-specific coverage | **8/8 passed** within the above gate, both languages; mailto activation intercepted, no email sent. Selectable address fallback works with JavaScript disabled. 390px and wide-footer screenshots visually checked. |
| Dedicated identity browser suite | **8 passed**: generation/backup/returning, cleared storage recovery, shared-device ownership, failed/corrupt storage, concurrent tabs, network retries and stale-session actions |
| Account compatibility | **38/39 passed** in the full rerun after the input correction; the one 30-second shared-device timeout passed on an unchanged focused rerun (**1/1**). Thus all 39 scenarios have passing fresh evidence, with the timeout retained as an intermittent result. |
| Learner lifecycle | **7/7 passed** on a sequential rerun. Initial run: 5 passed / 2 timing failures (welcome codes and deletion), while the local Docker build ran. The welcome failure's final snapshot contained the expected list; no timeout/assertion/rate-limit change was made. |
| Advanced signer compatibility | **18 passed**, simulated signer/relay and real API; separate from external app interoperability |
| Tester allowlist | **13 passed**, real API with the existing allowlist enforcement; unlisted valid signatures and invalid signatures refused |
| Account-enabled footer/layout | **14 passed** in an additional desktop-project run against the account-enabled export, including both languages and 390–1920px footer widths |
| Static public export/runtime | `check-public-export`: **130 indexable pages / 921 files / 10 noninteractive account pages**; `check-public-runtime`: **242 passed** |
| Railway proxy isolation | `check-railway-proxy`: **99 passed**, temporary local Docker stack; not a claim about live ingress beyond the read-only staging observations |
| Proxy client-address/log regression | `bash scripts/check-proxy.sh`: **all passed** after retry with protected local Docker access; forged header handling, per-source recovery limits, callback code/state redaction and security headers checked. Temporary containers/networks removed. Full client addresses in NGINX error logs remain documented. |
| Staging web image | Local Docker build of the web image with the staging origin: build, links and size gates passed for **146 pages**. `check-staging-export` on the files copied out of that image: **146 noindex pages, 390 sitemap/language URLs on the staging origin, robots disallow all**. Its sign-in page has the Save Progress control, no GitHub link, and relay WebSockets allowed only there; a lesson page carries the feedback link and no relay permission. Built locally, not deployed. |
| Final recheck before recording | On Node 24.20.0: unit tests **247 passed / 42 files** with two workers (a fully parallel run timed out two unrelated 5-second tests under load), ESLint and frontend `typecheck` passed. |
| Dependency audit | Root/API production dependency audits: **0 vulnerabilities** at execution |

The initial account run passed 37/39; two assertions counted the new read-only feedback recipient as a credential field. They now require exactly one **editable** non-radio input (recovery) and explicitly require the feedback field to be read-only. The existing no-account-request, no-key-storage and accessibility assertions remain. An earlier feedback check exposed the summary accessibility role issue, which was corrected before the passing focused/public runs. No test timeout, rate limit, assertion purpose or budget was relaxed. Raw test fixtures/traces remain local rather than being published as learner evidence.

The production build passed, including CSP generation, links and size gates for **146 pages**. First-lesson compressed transfer is **182.7 KiB / 200 KiB** (account-enabled local build **183.0 KiB / 200 KiB**). Feedback adds **no client JavaScript**. Static UX measurements remain equal to the established baseline: home **144.32/144.9**, roadmap **144.50/145.1**, catalogue **142.67/145**, simulation **142.17/145**, lesson **147.01/147.3**, lab **153.03/153.2**, tree **144.50/145.1 KiB gzip**. All existing per-route budgets passed unchanged. The build still emits its pre-existing 100 KiB aspirational-runtime warning; this is not a newly introduced budget or a claim that every page is below 100 KiB.

Real-browser simulation requests measured **142.765 KiB initial**, at most **146.670 KiB activated** and **3.906 KiB additional**, within the existing **145 / 150 / 6 KiB** limits. No budget was increased. OS email-client configuration/delivery, physical devices, authenticated Firefox/Safari, real advanced signer interoperability and live new-feature staging acceptance remain manual/unexecuted, rather than being inferred from local automation.

Reproducibility: local host Node **24.19.0**, npm **12.0.2**. The host Node is below the declared `>=24.20.0` floor; no engine requirement was changed. The proxy test builds/runs the pinned API Node **24.22.2** image. Hosted CI with the repository's `.nvmrc` runtime has not run for these unpushed commits and remains required before integration; local pass counts do not claim a green hosted workflow.

## Readiness

The signed local change set is prepared for review and controlled staged PR preparation; no PR has been opened. Integration remains subject to supported-runtime hosted CI and explicit authorization for the subsequent push/PR/deployment steps. Live identity/feedback staging acceptance remains blocked by undeployed code and empty tester enrollment, not by a request to weaken isolation. Public account release is **not ready** until live acceptance and the operational/privacy/legal gates above are completed. New feedback helper Kiswahili copy is flagged for owner review. Production's existing anonymous educational deployment remains unchanged.
