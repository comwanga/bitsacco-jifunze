# Review stages

Branch: `audit/savers-curriculum`, based on `03bc84a9c38f13e121ebf557bd676b2d30d4a0f7`.

Review these as separate changes; do not combine the whole branch into one large pull request. No remote branch, pull request, deployment or publication was created by this audit.

| Stage | Principal files | Evidence / dependency |
| --- | --- | --- |
| 1. Verified engineering corrections | `lib/content/validate.ts`, stale-tab merge in `lib/progress/useProgress.ts`, `tests/content/validate.test.ts`, `e2e/progress-tabs.spec.ts` | Reproduced prerequisite/section defects and stale-tab loss before correction. Initial engineering selection is staged locally; later discussion changes in the hook/test are unstaged. |
| 2. Curriculum and subject discovery | `content/savers/`, Savers quiz files, `content/roadmaps/savers.json`, glossary, content navigation/schema/tree, roadmap/home/reader navigation, content/navigation tests | Preserve eight introductory slugs. Six personal, five community and five cooperative lessons; guided prerequisites, bilingual quizzes, original cases, sources and review flags. |
| 3. Required discussion across paths | English/Kiswahili reflection additions in all three tracks, builder explanations, `ReflectionCheck`, lesson/quiz completion controls, `lib/discussion-copy.ts`, progress timestamp/import/merge, discussion browser/unit tests, attributions/contributor guidance | User explicitly required the questions as curriculum. No answers collected, no expert-grading claim, legacy completions retained. Some files overlap stage 1/2 and require selective hunks when committing. |
| 4. Financial practice and measured budget allowance | `SavingsSimulation`, `lib/simulations/savings*`, registry/loader/shell, scenario tests, added activated-budget cases, `lib/build/budget.ts` | One fictional model, no real-money integrations. User-requested general ceiling 150 → 151 KiB; stricter learner, activated, lab and first-lesson gates unchanged. |
| 5. Lab resource cleanup and final records | `lab/jifunze_lab/runner.py`, `lab/tests/test_runner.py`, audit/curriculum reports, README/docs index, two stale browser text/selector expectations | New regression reproduces unclosed output readers. Linux 44-test suite passes with ResourceWarnings treated as errors. Browser assertions retain interaction/accessibility requirements. |

The local Git configuration requires SSH-signed commits. The initial signed commit waited for an encrypted-key unlock and did not complete. Its stalled signing subprocess was stopped to release Git's lock; signing requirements were not disabled, no private key was read, and staged/source changes were retained. Unlock the signing key locally before recording signed commits; do not share a passphrase in chat. The stage table documents review boundaries while that external prerequisite remains unresolved.

The [platform audit](2026-11-11-platform.md) contains actual checks, failed attempts, reruns, measurements and remaining gates. The [curriculum record](2026-11-11-curriculum.md) contains objectives, sources, Chaincode mapping and human-review requirements. Approval to publish, push or deploy has not been granted.

## Independent review: revised integration order

This ordering supersedes the proposed table above. That table separated related changes too late: curriculum navigation reads `reflectedAt`, curriculum browser tests import discussion copy, and all-track prompt coverage needs the discussion additions. The general budget allowance also needs to accompany the earliest stage that requires it. Combining unrelated lab cleanup with final records obscured a separately reviewable correction.

| Order | Commit / PR boundary | Required selection and verification |
| --- | --- | --- |
| 1 | Verified engineering corrections | Content graph validation and tests; only the stale-storage merge hunk in `useProgress.ts` and its pre-discussion browser regression; lab output-reader cleanup and regression. Keep the lab correction as a separate signed commit within this engineering PR. These corrections do not require new curriculum or discussion APIs. |
| 2 | Required discussion and compatible progress | `reflectedAt` model/import/merge/activity tracking, hook completion/lab gates, `ReflectionCheck`, completion/quiz UI, discussion copy and paired prompts in the original 33 lessons, associated builder explanations, attributions and contributor guidance. Include the approved general 151 KiB ceiling here so later dependent stages inherit it; retain every stricter UX gate. Adapt the stale-tab test to confirm discussion here. Split `next.ts`, `i18n.ts`, lesson page and shared tests by hunk; optional-section navigation belongs to stage 3. |
| 3 | Savers curriculum and navigation | All 16 bilingual lesson/quiz pairs (including their required prompts), introductory accuracy corrections and corresponding table expectations, glossary/review flags, roadmap/schema/tree/reading/resume changes, `SpecializationChoices`, navigation and curriculum tests, catalogue/count assertions and direct-child mobile-menu selector. Include the all-49-lessons discussion coverage assertion here; stage 2 only covers the original 33. |
| 4 | Fictional financial simulation | Savings model/copy/UI, registry/loader/shell, unit/browser tests and new activated-budget cases. Its six related lesson targets now exist from stage 3. No further budget relaxation. |
| 5 | Final audit and evidence records | Audit/curriculum/independent-review reports and README/documentation links. Describe the final code and exact verification limitations; avoid claiming partial-stage validation from a final-tree run. |

These are dependent, ordered PRs, not five interchangeable patches. Use selective hunks or a temporary integration checkout when preparing them. Preserve the current index and working tree until that preparation is explicitly undertaken; the existing staged selection is not the revised series. Run applicable checks on each resulting commit/PR head, including a complete serial browser run on the final assembled head. This review validates the assembled working tree, not yet-created intermediate commits.

See the [independent review](2026-11-11-independent-review.md) for fresh PostgreSQL, Docker and browser evidence, retained skips, and human-review gates. No commits were attempted during independent review and signing settings were not changed. If an encrypted signing key still needs unlocking, unlock it locally before making signed commits; do not bypass signing.
