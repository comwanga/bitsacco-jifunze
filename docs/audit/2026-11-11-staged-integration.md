# Staged integration record — 11 November 2026

Baseline: `03bc84a9c38f13e121ebf557bd676b2d30d4a0f7` (`main`). Source branch: `audit/savers-curriculum` (uncommitted working tree, preserved unchanged apart from the documentation and test-file edits listed below).

This record covers extraction of the independently reviewed work into five dependency-ordered local stages. It does not repeat the [platform audit](2026-11-11-platform.md), [curriculum record](2026-11-11-curriculum.md) or [independent review](2026-11-11-independent-review.md). Nothing was pushed, opened as a pull request, merged, deployed or published.

## Stages, commits and order

The stages are a stack, not interchangeable patches. Each branch is based on the previous one; open pull requests in this order, each against the preceding stage (or merge in order).

| Stage | Local branch | Commit(s) | Content | Depends on |
| --- | --- | --- | --- | --- |
| 1. Engineering corrections | `integration/savers-signed-1` | `860756c` core, `12af788` lab | Duplicate-section and cyclic-prerequisite validation; stale-tab progress merge; lab output-stream cleanup; their regressions | baseline |
| 2. Required discussion and progress compatibility | `integration/savers-signed-2` | `3916081` | `reflectedAt` model/import/merge, completion and quiz gating, `ReflectionCheck`, bilingual copy, paired prompts in the original 33 lessons, general JavaScript ceiling 150 → 151 KiB | 1 (extends the same hook and stale-tab test) |
| 3. Curriculum expansion and navigation | `integration/savers-signed-3` | `8453e58` | Six individual, five community and five cooperative Savers lessons in English and Kiswahili, quizzes, roadmap/schema/tree/navigation, glossary and terminology records, owner review record | 2 (new lessons carry required prompts; navigation reads `reflectedAt`) |
| 4. Financial scenario simulation | `integration/savers-signed-4` | `aedebe6` | Fictional household, group and cooperative scenarios in the existing lazy simulation registry; calculation, boundary, accessibility and activated-budget tests | 3 (links to the new lessons) |
| 5. Documentation and audit records | `integration/savers-signed-5` | this commit | README and documentation index, audit, curriculum, independent-review and this record | 4 |

Adjustments from the proposed grouping, each the smallest that keeps every stage passing against its base:

- The lab stream cleanup is a second commit inside stage 1 rather than part of the final records, as the independent review recommended.
- The 151 KiB general ceiling arrives in stage 2, the first stage whose build needs it. The value is not raised again.
- The owner review record is added in stage 3, because `CONTRIBUTING.md` and the terminology records in that stage link to it.
- The all-lesson discussion-prompt assertion moved from `tests/content/savers-expansion.test.ts` to `tests/content/discussion.test.ts`, and `e2e/discussion.spec.ts` was separated, so stage 2 is testable on the original 33 lessons and automatically covers all 49 from stage 3.
- In stages 2–4, `ATTRIBUTIONS.md` and a comment in `lib/build/budget.ts` omit one sentence linking to audit documents that only exist from stage 5; stage 5 restores them.

## Validation executed on each extracted stage

All runs used an isolated worktree with its own dependency install (`npm ci --offline`). "Check" is lint, typecheck, unit tests and content validation. Browser runs were serial, with no retries.

| Stage tree | Check | Build and budgets | Browser |
| --- | --- | --- | --- |
| 1 | 31 files / 160 tests; content 0 errors, 69 warnings | Build, UX budget and public export (96 indexable pages) pass; first lesson 176.1 KiB | Stale-tab regression: 2 passed |
| 1 lab | 44 lab unit tests pass in a Linux container with `ResourceWarning` as error | — | — |
| 2 | 32 files / 163 tests; 0 errors, 69 warnings (run twice; second run on the final extraction) | Pass at the 151 KiB ceiling; first lesson 177.4 KiB | Discussion, legacy completion, stale tab, quiz: 16 passed |
| 3 | 34 files / 166 tests; 0 errors, 101 warnings | Pass; 128 indexable pages; first lesson 180.7 KiB | Curriculum, catalogue, home, tree, reader, tables: 67 passed, 5 skipped |
| 4 | 35 files / 170 tests; 0 errors, 101 warnings | Pass; 130 indexable pages; first lesson 180.7 KiB | Savings simulation, activated budgets, simulations: 28 passed, 6 skipped |
| 5 (final combined) | 35 files / 170 tests; 0 errors, 101 warnings | Pass; 130 indexable pages, 908 files; first lesson 180.7 KiB of 200 | Complete public suite: **242 passed, 62 skipped, 0 failed, 0 flaky** (304 cases) |

The content warnings are missing dual-review dates and three existing terminology warnings; they are not errors and no date was added. The final browser total exceeds the independent review's 234 by the eight cases in the separated discussion specification. The 62 skips are the same project/viewport deduplication the independent review documents.

Initial-page JavaScript on the final tree is 146.77 / 147.3 KB (lesson), 152.79 / 153.2 KB (lab) and 144.25 / 145.1 KB (tree). `lib/build/ux-budget.ts`, the 165 KiB lab ceiling, the 200 KiB first-lesson gate and the 145 / 150 / 6 KiB activated-simulation gates are unchanged from the baseline.

After the complete run, the only changes to the stage 5 tree were to this record and one paragraph of the platform audit; lint, typecheck, unit tests and content validation were repeated on the committed stage 5 tree.

### Not re-executed during integration

`api/`, `.github/`, Docker and proxy configuration, `package.json`, lock files, `next.config.ts` and `public/sw.js` are byte-identical to the baseline in every stage. The following results therefore remain the independent review's and were not re-run on the extracted heads: 261 PostgreSQL API tests, 35 account and 12 allowlist browser tests, production and staging container builds, NGINX/proxy checks, dependency audits, and the live lite-lab acceptance.

The independent review's lab reliability observation stands unchanged: the first live lite-lab run failed two exercises after initial block generation exceeded the 30-second RPC timeout; a fresh isolated rerun passed 19 exercises. The live lab was not run again here, so there is neither a recurrence nor new evidence of a fix, and no timeout was altered.

## Corrections made during integration

- Removed a trailing blank line at the end of `tests/content/savers-expansion.test.ts` that failed `git diff --check`.
- The test and link adjustments listed under "Adjustments" above.
- Documentation updates recording the owner review and this integration.

No application behaviour was changed during integration.

## Consistency check against the source branch

Compared with the `audit/savers-curriculum` working tree, the stage 5 head contains every changed or new source file with identical content, introduces no file outside that set, and excludes the unrelated untracked `debug.log`. No secret patterns, build output, logs or environment files are committed. The source branch's HEAD and index were not modified.

Existing progress stays compatible: `reflectedAt` is an optional field in the version 1 format, historical completions are retained without it, and the eight introductory Savers slugs and progress keys are unchanged.

## Review and acceptance status

| Item | Status |
| --- | --- |
| Owner educational review (Kiswahili, Bitcoin accuracy, financial concepts, chamas, SACCOs and cooperative savings, documentation) | **Completed 11 November 2026**, as reported by the project owner. See the [owner review record](2026-11-11-owner-review.md). |
| Automated technical verification | **Completed** for the scope in the tables above. |
| Independent technical-content sign-off required by `CONTRIBUTING.md` before a launch announcement; second documented reviewer for `lastReviewed` dates | **Outstanding.** Dates remain unset; none was invented. |
| Independent financial/cooperative specialist and practical assistive-technology review identified by the independent audit | **Outstanding.** |
| External acceptance: real GitHub consent and installed Nostr signer flows, Railway edge/DNS/TLS/logs, full-profile Eclair exercise, Codespaces rebuild, Kiswahili book publication | **Outstanding.** |
| Production release authorization | **Not granted.** |

## Signing

All commits are SSH-signed and verify against the repository's allowed-signers file with the key `SHA256:bPPXDeLtQvvCK93cyzClgXpIY/m1IH8AQfiKgVlfAU4`, the key that signed the preceding history. Signing was never disabled and no private key or passphrase was accessed.

The earlier stalled attempt was not a locked key. The repository-local `user.signingkey` names `id_ed25519.pub`, which is neither loaded in the SSH agent nor listed in the allowed-signers file, so Git waited on a prompt. The integration commits passed the agent-held public key for each commit command only; the stored Git configuration was left as found. The owner should decide whether to correct that local setting.
