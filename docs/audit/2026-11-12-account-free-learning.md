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

- The feedback link from the reviewed feedback commit, unchanged in behaviour: a server-rendered `mailto:` link with lesson title and page address, and a copy-address fallback that works without JavaScript.
- "Send Feedback" / "Tuma Maoni" in the header where "Account" was: after the language switch on wide screens, last in the menu on phones. The header link carries no page or learner context.
- The footer link and the link beside lesson navigation stay. The lesson link is the only one that names the lesson.

**Unchanged**

- Lessons, quizzes, simulations, the Lightning lab, the library, the glossary and offline reading.
- Local progress: the same storage key and file format (`jifunze:progress:v1`, version 1), the progress page, and export and import. Nothing is migrated or cleared. The progress page already says progress is saved on this device only.
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

| Pull request | Recommendation |
| --- | --- |
| #18 design, #19 to #22 Nostr API, progress storage, progress sync, account experience | Close as superseded by this decision |
| #23 remote signer support | Close as superseded. Its staging proxy fix only matters while the API is proxied |
| #24 built-in learning identity | Close as superseded |
| #25 feedback and final records | Close as superseded. The feedback commit is carried here by cherry-pick (`1968252`, now `c54fc89`); the account records in it are not |

The staging acceptance record for the rejected experience exists only as local commit `04f8103` on `feat/learning-identity`. It is history, not a plan.

## Staging

Staging still runs the rejected build (`b702a14`). It is safe meanwhile: authentication cannot succeed with an empty allowlist. Deploying this branch's web image to staging replaces the account pages with 404 and adds the header feedback link. That deployment, and any merge to `main`, need separate authorization.

## Risks

- A learner who bookmarked an account address gets the ordinary 404 page.
- Progress lives only in the browser. Clearing browser data or losing the phone loses it unless the learner exported a file. The progress page says so.
- Feedback depends on the learner having a mail app; the copy-address fallback covers the rest.
- The Kiswahili helper text of the feedback link is pending owner review; the two action labels are the owner's wording.
