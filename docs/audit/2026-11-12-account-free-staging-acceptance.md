# Account-free staging deployment and acceptance

Run on 12 November 2026 at [staging](https://staging.bitsaccojifunze.xyz), for PR [#26](https://github.com/comwanga/bitsacco-jifunze/pull/26), commit `04905235d6e4a9021b2a8aed8389c063d62ebc03`. This records the completed run; the later [superseded-stack audit](2026-11-12-superseded-account-stack.md) retains an additional local-progress fix that was not part of this deployment.

## Deployment

Before deployment the exact head was signed and all three CI jobs passed. [CI run 43298905245](https://github.com/comwanga/bitsacco-jifunze/actions/runs/43298905245) passed `check`, `account` (retained API checks) and `lab`. Both staging services were rollback-eligible before deployment.

Only staging web was deployed. A read-only Railway inspection at `2026-11-12T20:44:51.789Z` reconfirmed the following:

| Component | Deployment / source | Result |
| --- | --- | --- |
| Staging web | `83a2a4d8-344d-4fa2-8a2b-e98459be80fe` / `0490523` | SUCCESS; image `sha256:775c42e02f3fa8eb330266b9d3b76f9527cf4f35c0694da05e86b6ba34266811` |
| Previous staging web | `3a599ec9-296a-4427-8013-ca8bfa56cded` / `b702a14` | Rollback-eligible at the predeployment check; no later eligibility promise |
| Staging API | `54f04926-aa26-4f44-8e31-099ad715b4e8` / `b702a14` | SUCCESS; unchanged |
| Staging PostgreSQL | `f8ac6eaf-5174-4157-9064-8304c295fe4e` | SUCCESS; unchanged |
| Production web | `04b97643-9ff7-45dd-ab39-433c68a2437b` / `3ec6b0d` | SUCCESS; unchanged, reconfirmed by read-only inspection at `2026-11-12T20:50:04.655Z` |

Staging has exactly three services, with one replica each. Only web has public HTTP domains. Automatic web/API deployment is disabled and no repository triggers are configured. The GitHub and Nostr tester lists are both empty. No database or allowlist mutation accompanied this deployment. The earlier database observation reported zero account, identity, session, progress and recovery-code rows; the read-only follow-up above inspected configuration, not database row counts.

The `20:50:04.655Z` deployment inspection also found the current web, previous web and API rollback-eligible. Eligibility is a point-in-time observation, not a guarantee for a later rollback.

At acceptance and the follow-up inspection, `STAGING_AUTH_ENABLED=1`: the proxy still forwards `/api/` to the old API. Its enforced empty tester allowlist prevents authentication, and the account-free pages make no API requests. Disabling this proxy access is a separate staging configuration decision; removing the API/database remains separate cleanup work.

## Live Chromium acceptance

The original [27-step result file](evidence/2026-11-12-account-free-staging-results.json) is preserved verbatim (SHA-256 `3e733594c7eca3ab16d043bc819d5fd7839892bb78dbe67ce033f8079ec33eca`). Every step passed. Its timestamps record final result-file serialization at `2026-11-12T20:38:32.815Z`, not the individual step execution times.

| Coverage | Observed result |
| --- | --- |
| All sitemap pages, both languages | 130 pages returned 200; every page had header feedback; no account link or sign-in control |
| English and Kiswahili, desktop and emulated Pixel 7 | Correct header feedback action; phone menu placement; recipient `mwanga@bitsacco.com`; no horizontal overflow |
| Lessons and quiz in all four combinations | Quiz 4/4 and completion saved on device; no account/API request |
| Progress export/import in all four combinations | Export restored progress after the browser copy was removed; device-only wording present |
| Offline reading in all four combinations | Previously opened lesson reloaded and remained readable offline |
| Retired account addresses in all four combinations | Account home, sign-in, welcome, recovery and sign-out each returned 404; no form, input or sign-in control |
| Feedback in header, footer and lessons | Correct recipient and copy-address fallback; only lesson feedback named the lesson and its address |
| Accessibility | No violations in the configured axe scans on home, lesson and progress pages |
| Existing browser progress | Two lessons and quiz score preserved with leftover account markers; no account request |
| JavaScript disabled | Server-rendered mail links and readable/copyable address remained usable |

The run used real Chromium against the live hostname. Phone coverage was device emulation; no physical phone was used. Screenshots and the runner remain locally under `.superpowers/staging-acceptance/` (screenshots in `evidence-account-free/`); this committed record preserves the sanitized result JSON rather than adding those images to Git.

## Performance and remaining review

Performance budgets were checked by CI and the local build on this same `0490523` commit; they were not re-measured on staging. The recorded local results were first lesson 182.8/200 KB and lesson JavaScript 146.77/147.3 KB gzip. No budget was raised.

The feedback action labels, “Send Feedback” and “Tuma Maoni”, are the owner's wording. The new Kiswahili helper/instruction text remains pending owner review. Passing browser checks does not supply that language approval. #26 remains open and unmerged; this record authorizes neither a production deployment nor an infrastructure cleanup.
