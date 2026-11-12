# Audit of superseded account pull requests #18–#25

Recorded 12 November 2026 against account-free PR [#26](https://github.com/comwanga/bitsacco-jifunze/pull/26), initially at `04905235d6e4a9021b2a8aed8389c063d62ebc03`. The owner rejected the account experience. This audit checks for curriculum changes and fixes that remain useful without accounts; it does not approve a future account release.

## Disposition

Reviewed each PR's scope, exact head, changed paths and commits against `main` (`3ec6b0d`) and #26. There are no lesson MDX, quiz-content, roadmap-definition, simulation or lab changes to recover. Changes under `content/` are terminology-review records for the account interface and feedback.

| PR | Audited head | Decision |
| --- | --- | --- |
| [#18](https://github.com/comwanga/bitsacco-jifunze/pull/18), identity design | `c1af5ce` | Superseded design. Its quiz tie-break is retained through the independent #20 fix below. Keep the original design in branch history. |
| [#19](https://github.com/comwanga/bitsacco-jifunze/pull/19), Nostr account API | `9eff434` | Account lifecycle, optional GitHub, session-cookie policy and recovery-code rotation apply to the retired API. Do not transplant them into account-free learning. |
| [#20](https://github.com/comwanga/bitsacco-jifunze/pull/20), progress API | `f27198a` | Retain `6c006589ead0e7099fee964115fb90a12264bca7`: deterministic quiz merging also fixes local file import. Leave the account progress API and migration in branch history; the existing staging table is not dropped. |
| [#21](https://github.com/comwanga/bitsacco-jifunze/pull/21), progress synchronization | `069816d` | Account ownership, synchronization, status copy and account browser tests are superseded. Local progress remains independent of account markers. |
| [#22](https://github.com/comwanga/bitsacco-jifunze/pull/22), account recovery UI | `9af5ee9` | Account conditions, lifecycle UI and recovery are superseded. Removing account IDs from API request logs is a useful privacy improvement, but concerns the retained API; preserve it at `d1884e4` for the separate API cleanup/review decision. |
| [#23](https://github.com/comwanga/bitsacco-jifunze/pull/23), remote signing | `a480c76` | Signers, relay dependencies and sign-in CSP exceptions are superseded. Proxy fix `0cb4438` strips the account-condition header from the tester-gate subrequest; it is needed by the staged account API, which supports that header, not by the baseline API in #26. Preserve the fix in branch history; do not restore account infrastructure in this PR. |
| [#24](https://github.com/comwanga/bitsacco-jifunze/pull/24), built-in identity | `f3bf8f2` | Browser keys, account copy and account tests are superseded. No anonymous-learning fix to extract. |
| [#25](https://github.com/comwanga/bitsacco-jifunze/pull/25), feedback and account records | `b702a14` | Feedback commit `1968252` is already carried in #26 as `c54fc89`, with header feedback added in `3fcff80`. Feedback implementation, tests, documentation and pending helper-text review are retained. Account-specific acceptance/privacy records and test corrections remain historical. |

Close all eight PRs as superseded after publishing the retained fix in #26. Preserve their branches and commits. Closing these PRs does not merge #26, deploy a new build, remove infrastructure or approve the pending feedback translation.

## Independent quiz-merge correction

`useProgress.importText()` parses the version 1 file and calls `mergeProgress()`. That same merge also combines an in-memory update with the latest browser-storage copy. The old rule selected whichever score was first when both the percentage and timestamp matched: importing `2/4` into `1/2` kept `1/2`, while reversing the copies kept `2/4`.

The retained fix prefers more questions only after percentage and earliest timestamp tie. It preserves the storage key, version 1 file format, completion and reflection timestamps, and lab passes. It adds no account code, dependency or migration. The source comment is adjusted to describe local progress rather than claiming the unused API was updated.

The file export/parse/merge reproducer failed before the fix and passed afterward. The original five deterministic regression/property tests are retained, covering 3,000 generated cases per property: commutativity, associativity, idempotence, preservation of achievements, and explicit ties (including zero-question legacy scores). Browser regressions exercise both import orders, download the merged file and verify persistence after reload in both languages, without account requests. The retained fix is commit `901c1ee`; follow-up validation is recorded in the PR's audit comment.

## Evidence boundary

The [staging acceptance record](2026-11-12-account-free-staging-acceptance.md) covers `0490523`, before this retained fix. Publishing this audit changes #26's head. Earlier green CI and staging acceptance must not be represented as acceptance of the new head. Merging #26 and deploying its new head remain separate actions.
