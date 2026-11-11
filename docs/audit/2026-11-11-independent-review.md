# Independent review of the uncommitted audit

Reviewed on 11 November 2026 on `audit/savers-curriculum`, against `03bc84a9c38f13e121ebf557bd676b2d30d4a0f7`. This supplements the [original audit](2026-11-11-platform.md); it does not turn earlier failed or unexecuted checks into passes.

**Subsequent owner review, 11 November 2026:** the owner reports completing educational review of Kiswahili, Bitcoin accuracy, financial concepts, community/chama/SACCO/cooperative savings and documentation. See the [owner review record](2026-11-11-owner-review.md). References below to pending human review describe the independent audit's original state; they no longer mean the owner's initial review is pending. Independent policy/specialist sign-off, accessibility, external acceptance and release authorization remain separate. No lesson dual-review dates or reviewer identities were invented.

## Verdict and preservation

The assembled implementation is suitable for **staged maintainer and educational review**, with the integration order corrected below. No introduced P0/P1 defect or confirmed material application regression was found. It is not unconditionally release-ready: human content sign-off, external acceptance, and investigation/repetition of the observed lab setup timeout remain gates. No new application feature or speculative refactor was introduced during this review.

The complete initial change inventory comprised 113 tracked diffs and 62 untracked files, including all 32 new MDX files and 16 quizzes. A preservation snapshot copied all 175 changed/new files, their SHA-256 hashes, the full tracked patch, the original index patch and status before review. HEAD and the existing index remain unchanged. No existing file was removed. Review edits are limited to this report, an appended verification record, the revised staging document, a curriculum-map correction and an explicit pending terminology-review item. Application code, tests, security settings and deployment configuration were not changed by independent review.

Local evidence is retained in `.superpowers/independent-review-2026-11-11T17-44-23-949Z/`. Its `manifest.json`, `files/`, `tracked.patch` and `index.patch` preserve the starting work. `commands.jsonl` records subsequent acceptance command exit codes/times; browser JSON, per-case results, skip annotations and individual command logs are retained. `preservation.json` records the final comparison. These ignored artifacts are local evidence, not committed release artifacts. No credentials belong in the portable report. The unique review database/role and disposable stacks were removed; the original PostgreSQL container and existing application/lab data were retained.

## Material findings and corrections

| Priority / classification | Finding, evidence and disposition |
| --- | --- |
| P2 — DOCUMENTATION DRIFT | The original five stages put curriculum before the discussion model/copy/tests it uses, delayed the budget allowance, and grouped independent lab cleanup with final documentation. Revised the [integration order](2026-11-11-review-stages.md#independent-review-revised-integration-order), identifying shared files that require selective hunks. No index changes or partial commits were made. |
| P2 — REQUIRES HUMAN REVIEW | `kaulimbiu ya ziada` is the working translation of an optional wallet derivation passphrase in `custody-recovery` and its quiz. Added an explicit pending review item distinguishing it from seed words and a screen PIN. A native technical Kiswahili reviewer must choose/approve the term; this review does not invent a translation or sign-off. |
| P3 — DOCUMENTATION DRIFT | The curriculum map named stokvel/tanda examples, while the implemented comparison uses chama/arisan/pandero. Corrected the map to the actual lesson. |
| P2 — UNVERIFIED root cause / reliability observation | The first live lite-lab suite failed two exercises after initial 101-block generation exceeded the existing 30-second RPC timeout. A second complete run on a new isolated stack, after other builds/browser suites finished, passed 19 exercises with one expected full-profile skip. Both runs are retained. Load sensitivity is a hypothesis, not a proven cause or an introduced regression. Repeat on the intended CI host; investigate if it recurs. No timeout, assertion, isolation or security requirement was relaxed. |
| P2 — REQUIRES HUMAN REVIEW | All new/changed educational passages remain drafts. The existing dual language/technical approval requirement still applies. Missing review dates are warnings, not fabricated approvals. Financial/cooperative and accessibility user review remain necessary. |

The review did not reproduce a material defect requiring another application correction. The original corrections themselves are justified: acyclic prerequisites and unique section IDs, stale sequential-tab progress preservation, qualified monetary/custody claims, and closing drained lab output readers. Existing focused regression coverage was executed without weakening it.

## Curriculum and learner integrity

The 16 additions provide meaningful depth for progressive financial literacy: six individual, five community and five cooperative lessons, all paired in English/Kiswahili. Bodies contain roughly 493–584 English words and 461–547 Kiswahili words per lesson, excluding front matter. Word count is supporting inventory, not the quality criterion. Each has three objectives, a distinct worked case, a private fictional exercise, three reasoning prompts, relevant sources and a four-question bilingual quiz with explanations. The 64 new quiz answers and worked arithmetic were independently checked. These are advanced Savers modules, not a professional accounting, legal or full Bitcoin-protocol qualification.

- Individual cases distinguish a positive monthly total from a dated cash gap, inflation from currency depreciation, real purchasing power from nominal returns, quoted value from net accessible money, seed/PIN/passphrase/configuration from one another, and key control from legal entitlement. Diversification, correlated recovery failures, inheritance and realistic sovereignty are discussed without guaranteed returns or allocation advice.
- Community cases distinguish ROSCAs, accumulating funds, CARE-style VSLAs and enduring cooperative institutions. Six-member rotations include the 2,500 default gap; governance distinguishes quorum from vote denominator; contribution recognition remains separate from sats, fees and revaluation. Multisignature does not prove consent, eliminate collusion or revoke a departed official's old key. Treasury cases test promised payouts, privacy, withdrawal access and stop conditions.
- Cooperative cases distinguish ownership shares, deposits and loans, liquidity from solvency, member liabilities from assets, internal controls from independent audit, and technology from institutional authority. The 5,000 timely-cash gap, separate −5,000 equity case, duplicate-deposit error, collateral shortfall and office-disaster recovery are coherent. No lesson authorizes a SACCO/credit union to custody, invest, accept or lend member Bitcoin.

Kenyan examples remain authentic while Indonesia/Peru group comparisons and a Nairobi/Madrid payment scenario support global relevance. The comparison explicitly avoids equating regional names with legal forms. Primary-source checks support the distinctions: [FAO group methods](https://www.fao.org/4/y4094e/y4094e04.htm), [World Bank ROSCA examples, p. 34](https://documents1.worldbank.org/curated/en/453121468331738740/pdf/WPS6025.pdf), [CARE's VSLA model](https://www.care.org/our-work/economic-growth/savings-groups/vsla-101/), [ICA principles](https://www.ica.coop/en/cooperatives/cooperative-identity/), [Bank of England money creation](https://www.bankofengland.co.uk/quarterly-bulletin/2014/q1/money-creation-in-the-modern-economy), [IMF inflation](https://www.imf.org/en/Publications/fandd/issues/Series/Back-to-Basics/Inflation) and [NCUA digital assets](https://ncua.gov/regulation-supervision/regulatory-compliance-resources/financial-technology-and-digital-assets). NCUA material is identified as US-specific and supplies no universal permission. The [curriculum record](2026-11-11-curriculum.md) contains the remaining technical references and topic mapping.

The [Chaincode source repository](https://github.com/chaincodelabs/seminars) supports the discussion-based method; the direct GitBook URL again returned an unsupported Markdown content type to the web reader. Jifunze credits pedagogical inspiration and authors its own questions. It does not claim to have reproduced the complete seminar.

The original eight introductory lessons, URLs and progress keys remain. Specializations extend the existing roadmap, schema, tree and reader; they do not create a parallel curriculum. Choosing a subject remains optional; discussion within each chosen lesson is required. Branch completion returns to a choice rather than pushing Savers into a technical course.

`reflectedAt` is an optional version-1 field. Historical `completedAt` entries remain complete without a new discussion timestamp. Import/export and merging preserve them, earliest completion and best quiz results. The write correction merges the latest persisted snapshot before a stale tab replaces it; its delayed-storage-event regression passes. This is not a transaction/lock guarantee for precisely simultaneous localStorage writes, nor cross-device account sync.

Discussion uses a native button, explanatory text, a completion prerequisite link and status feedback. Quiz/lab success cannot bypass the hook's new-completion requirement. No response field, submission handler or response storage was added: only self-attestation and existing progress are retained. Supplementary probes confirmed legacy completion in both languages and keyboard-only confirmation/completion with normal and blocked storage. They observed no answer inputs or API requests. The checks establish tested semantics and flows, not universal screen-reader certification or expert grading.

The financial model states fictional one-period assumptions. It applies price change, percentage conversion cost then fixed cost (capped at proceeds), two-decimal rounding, expense change, and deadline availability separately. Invalid/nonfinite/out-of-range inputs are rejected. Household −3,200, community +4,000/−10,000 and cooperative −5,000/−10,000 cases match the lessons. The cooperative second resource is explicitly expected loan repayment, not tradable Bitcoin or a complete balance sheet. There are no real funds, wallet connections, seeds, price feeds or provider calls.

## Fresh verification

Windows commands used Node **24.20.0**, satisfying `>=24.20.0 <25`, and npm **12.0.2**, with that runtime injected into child PATH. Docker acceptance used the repository's existing images/configurations and uniquely named review resources. Browser suites ran sequentially, each with **one worker and zero retries**, with separate output directories; no suite was overlapped with another browser suite.

| Check | Fresh result |
| --- | --- |
| `npm run check` | Exit 0: lint, TypeScript, 34 frontend test files / **170 tests**, content validation. |
| Final `npm run validate` | **0 errors, 101 warnings**: 98 missing lesson review dates and three terminology warnings. New pending terminology metadata does not assert approval. |
| Production build/postbuild; public-export check | Pass, including links, CSP, book integrity and budgets; 130 indexable pages, 10 noninteractive account pages. Production export rebuilt/restored after account testing and checked again. |
| Complete public Playwright suite | **234 passed, 62 skipped, 0 failed, 0 flaky** across desktop/mobile Chromium and WebKit table tests; all 296 cases represented in JSON. Includes offline, progress, bilingual, new curriculum/simulation, Axe and keyboard/table checks. |
| API typecheck and PostgreSQL suite | **9 files / 261 tests passed**, no database skips. Dedicated normal login/database owner, not a new superuser. |
| Complete account Playwright suite | **35 passed, 0 skipped, 0 failed**, including full-Chromium BFCache project; real local API/PostgreSQL with fake GitHub/test Nostr signers. |
| Complete allowlist Playwright suite | **12 passed, 0 skipped, 0 failed**, real local API/PostgreSQL with fake providers. |
| Supplementary discussion probes | Two historical-completion cases plus four keyboard/storage cases pass in English/Kiswahili; no response inputs/API requests observed. |
| Production dependency audits | Frontend and API: **0 vulnerabilities**, `--omit=dev --audit-level=low`, matching CI policy. Initial sandbox network errors preserved; authorized registry retries passed. |
| Docker production runtime | **242 checks pass**: static isolation, security headers, API 404/no session, PDF ranges, redaction, fail-closed misconfiguration and restart. |
| Docker synthetic Railway contract | **97 checks pass**; explicitly not proof of real Railway ingress. |
| Docker proxy acceptance | Pass: real API rate-limit peer boundaries, forged headers, callback/query-secret redaction and upstream failure behavior. |
| Docker staging image/export | Build and NGINX syntax pass; actual extracted image has **146 noindex HTML pages**, 390 sitemap/language URLs at the staging origin, robots disallow all. No deployment. |
| Production and lite/full lab Compose configuration | Both pass. |
| Docker Linux lab unit suite | **44 passed** with `ResourceWarning` treated as errors, using current source read-only. |
| Built current lab + live lite solution acceptance | First run **17 passed, 2 failed, 1 skipped** after setup timeout; fresh complete isolated rerun **19 passed, 0 failed, 1 skipped**. No test changes. See finding above. |
| Working-tree integrity | `git diff --check` passes; preservation comparison confirms no lost files, unchanged index and HEAD. Signing configuration unchanged. |

Important execution details: public Playwright completed its last test but Windows sandbox teardown could not terminate its own static web server. Only that reviewed server process tree was stopped with permission; the runner then exited 0 and wrote its complete JSON report with no runner errors. Account suites ran with the required process permissions and exited normally. An initial supplementary probe used an incorrect exact-text selector that omitted the existing checkmark; its log is retained, and the corrected probe passed without application changes. Neither issue was hidden as a successful initial attempt. The observed live-lab failure is separately retained and is not erased by a later pass.

### Preserved skips

`public-browser.json`, `public-summary.json` and `public-tests.json` retain each skipped case, project, source location and annotation. These 62 skips are existing project/viewport deduplication, not unavailable tests silently treated as passes:

| Recorded reason | Count |
| --- | ---: |
| markup is the same on both projects | 11 |
| markup is shared by both projects | 1 |
| both projects download the same JavaScript assets | 6 |
| these tests set their own viewports | 13 |
| wide screens only | 3 |
| phones only | 4 |
| phone layout only | 2 |
| static files are shared by both projects | 1 |
| one browser is enough for the service worker | 2 |
| phone menus only | 2 |
| sidebars show on wide screens | 2 |
| service-worker behaviour is shared | 5 |
| shared semantics; mobile flows covered separately | 10 |

The live lite lab separately skips `ch04-three-nodes` because it needs the full Eclair profile. Full-profile live acceptance was not executed; validating both Compose profiles is not equivalent to running that exercise. Account/allowlist and PostgreSQL suites have no skips.

### JavaScript budget decision

Only the general non-lab ceiling changes from **150 to 151 KiB** (+1,024 bytes / 0.67%). This is a project regression allowance, not a browser limit. The 100 KiB aspiration, 200 KiB first-lesson gate and 165 KiB general lab ceiling remain unchanged. `lib/build/ux-budget.ts` is byte-for-byte unchanged from the base. Fresh maximum initial measurements:

| Learner page | Measured KiB gzip | Unchanged gate |
| --- | ---: | ---: |
| Home | 144.06 | 144.9 |
| Roadmap / tree | 144.25 | 145.1 |
| Catalogue | 142.67 | 145 |
| Simulation | 142.17 | 145 |
| Reading lesson | 146.77 | 147.3 |
| Lab lesson | 152.79 | 153.2 |

First-lesson total is 180.7 KiB against 200. Actual browser-request assertions for all three simulators pass unchanged **145 KiB initial / 150 activated / 6 additional** gates. This fresh run measures the new simulator at approximately **142.17 / 146.67 / 4.50 KiB** respectively in both languages; these replace the earlier audit's request-level measurements. Transfer-size evidence does not certify low-end-device responsiveness. The 100 KiB aspiration remains unmet and documented.

## Integration and remaining gates

Use the [revised five-stage plan](2026-11-11-review-stages.md#independent-review-revised-integration-order): **engineering corrections → required discussion/progress → Savers curriculum/navigation → financial simulation → final records**. Keep the lab fix a distinct commit within the engineering stage. These are ordered dependent PR boundaries, not interchangeable branches. Validate each extracted head: this review tested the assembled working tree, not uncreated intermediate commits. The existing index was deliberately preserved, not silently repurposed as the final series.

The owner's educational review is completed as recorded above. Before release/integration approval, document the remaining policy-required sign-offs, including independent technical-content approval, and the independent financial/cooperative and practical assistive-technology acceptance identified by the audit. Preserve unset dual-review dates until their requirements are documented. Repeat live lab acceptance on CI and investigate any recurring initial-mining timeout. No source-level cause of that intermittent failure is claimed established here.

Remaining external acceptance includes real GitHub consent and installed Nostr signer flows, actual Railway edge/log/DNS/TLS behavior, full-profile Eclair exercise, Codespaces rebuild/connection and the independently pending Kiswahili book publication. Simulated local acceptance does not satisfy those gates. Any future institution-specific Bitcoin activity still needs current qualified jurisdictional/legal/accounting review; this platform review grants no financial-service authority.

No commit, push, PR, merge, deployment or publication was performed. No signing setting was changed and no unsigned-commit bypass was attempted. If the configured encrypted signing key still requires an interactive unlock, unlock it locally before creating signed commits; keep all changes intact and never send its passphrase in chat.
