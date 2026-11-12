# Decision: Jifunze is account-free

Recorded 12 November 2026. The owner reviewed the account experience deployed on staging and rejected it. This supersedes the Nostr-first identity direction and the earlier optional GitHub account.

The learner journey is: open Jifunze, choose a learning path, learn, track progress on the device, send feedback. Nothing asks for a login, an account, a Nostr identity, a signer app or recovery codes.

## What changed on this branch

Branch `feat/account-free-learning`, based on `main` (`3ec6b0d`), the commit production runs.

**Removed from the site**

- The five account routes in both languages: account home, sign-in, welcome, recovery and sign-out. They now answer 404, as any unknown address does.
- All account components and their copy: GitHub and Nostr sign-in, signer onboarding, recovery-code screens.
- The header "Account" link and the build flag that showed it outside production.
- The account and tester-allowlist browser suites and their CI steps, which tested the removed pages.

**Added**

- A server-rendered `mailto:` feedback link with public lesson title and page address. The owner's 13 November follow-up simplifies it to a single link: the earlier copy-address disclosure, address field and helper text are removed. Clicking opens the learner's email application, including without JavaScript.
- "Send Feedback" / "Tuma Maoni" in the header where "Account" was: after the language switch on wide screens, last in the menu on phones. The header link carries no page or learner context.
- The footer link and the link beside lesson navigation stay. The lesson link is the only one that names the lesson.

**Unchanged**

- Lessons, quizzes, simulations, the Lightning lab, the library, the glossary and offline reading.
- Local progress: the same storage key and file format (`jifunze:progress:v1`, version 1), the progress page, and export and import. Nothing is migrated or cleared. The progress page already says progress is saved on this device only. The follow-up audit retains the independent quiz-merge fix from #20: when percentage and timestamp tie, keep the attempt with more questions so local import order cannot change the result.
- Performance budgets. No budget was raised.

## Kept unused, pending a separate cleanup decision

These are not reachable from the site and no page calls them. They are kept so that removing them is a deliberate, reviewed step rather than a side effect.

| Item | State |
| --- | --- |
| `api/` (account API, sessions, recovery, GitHub and Nostr sign-in) and `docker/api.Dockerfile` | In the repository, unused. Its own tests still run in CI |
| Compose `api` and `postgres` services; nginx `/api/` proxy rules; the Railway staging proxy mode | In the repository, unused by the site |
| The service worker's rule that never caches `/account/` paths | Harmless; left as is |
| Railway staging `api` and `postgres` services | Running. The tester allowlist is enforced and empty, so nobody can authenticate. 0 accounts, identities, sessions, progress rows and recovery codes |
| Staging database schema, including the added `lesson_progress` table | Left in place. Nothing is dropped; the tables are empty |
| Production | Never had an API or database. Unchanged |

Suggested follow-up, each needing its own decision: remove `api/` and the proxy rules from the repository; let the staging web service run in the static mode production uses; then stop and delete the staging API and database.

## The earlier pull requests

None of #18 to #25 should merge into `main`. Their commits stay in Git on their branches.

The [completed scope audit](2026-11-12-superseded-account-stack.md) records the independent quiz-merge fix retained from #20 and the feedback already retained from #25. No curriculum edits were found. Account API/proxy fixes remain available in their original branches for a separate cleanup decision.

| Pull request | Recommendation |
| --- | --- |
| #18 design, #19 to #22 Nostr API, progress storage, progress sync, account experience | Close as superseded by this decision |
| #23 remote signer support | Close as superseded. Its staging proxy fix only matters while the API is proxied |
| #24 built-in learning identity | Close as superseded |
| #25 feedback and final records | Close as superseded. The feedback commit is carried here by cherry-pick (`1968252`, now `c54fc89`); the account records in it are not |

The staging acceptance record for the rejected experience exists only as local commit `04f8103` on `feat/learning-identity`. It is history, not a plan.

## Staging

The owner-authorized web deployment replaced the rejected build with `0490523`, deployment `83a2a4d8-344d-4fa2-8a2b-e98459be80fe`. The [committed acceptance record](2026-11-12-account-free-staging-acceptance.md) records 27/27 live Chromium checks, including English/Kiswahili desktop and emulated phone sessions. The API and database were not redeployed. The proxy still has authentication forwarding enabled at that checkpoint, with the tester allowlist enforced and empty. The later quiz-merge fix is not part of this deployed commit. Any subsequent deployment or merge to `main` remains separate.

## Risks

- A learner who bookmarked an account address gets the ordinary 404 page.
- Progress lives only in the browser. Clearing browser data or losing the phone loses it unless the learner exported a file. The progress page says so.
- Feedback opens the learner's configured email application.
- The only feedback action labels are the owner's wording: "Send Feedback" / "Tuma Maoni". The earlier helper/privacy text and email-body field labels are removed; their pending language review no longer applies. Earlier acceptance records describe their stated commits.
