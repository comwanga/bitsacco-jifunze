# Stage 4: learner account experience

Date: 12 November 2026. Branch: `feat/nostr-recovery-ui`, from Stage 3 `069816d`. The accepted design was read from `docs/nostr-first-design:docs/superpowers/specs/2026-11-12-nostr-first-identity-design.md`. Stage 1–3 history is preserved. No push, pull request, merge, staging switch or publication is authorized or performed by this work.

Implementation: SSH-signed commit `d1884e4` (`feat(account): complete the learner Nostr account experience`). Git verified a good ED25519 signature for the configured maintainer. This evidence report is recorded in a separate signed documentation commit; no runtime code changes accompany that record.

## Implementation and boundaries

The learner interface uses the existing purpose-bound Nostr challenge, re-authentication, replacement, recovery, deletion and session routes. No route, schema, provider or authentication architecture changed. A defensive request condition rejects account switches, and request logs no longer include account IDs, as detailed below. Account controls and their dictionary load after a Nostr account is confirmed. Anonymous learning still uses device progress and export/import without the API or sync download. No NIP-46, analytics, feedback identity, curriculum changes or account activation is included.

The account page offers new recovery codes, key replacement, deletion and sign out everywhere. Code regeneration, full-session replacement and deletion require a fresh proof from the existing identity, followed by separate action confirmation. The server still enforces identity, purpose, body digest, freshness, single use and session binding. Rejected, expired and mismatched proofs produce focused bilingual feedback. Missing signers have guidance without collecting a key.

Recovery-code entry uses a masked field and client-side format validation before sending anything. An unused code opens the existing 15-minute restricted session. The recovery page explains that a new identity attaches to the same account, keeping saved progress. The learner creates and backs up that identity inside the signer. Replacement uses the atomic Stage 1 operation, ends earlier sessions and invalidates all previous codes. Its new codes are shown once, kept only in memory, and can be deliberately downloaded or copied. They must be acknowledged before continuing. A lost response is an uncertain outcome; the page does not report success or silently repeat the action.

Beginner guidance explains public identity, signer control of the secret key, backups outside the phone, private recovery codes and separate identities on a shared phone. No signer is called supported. The existing external example remains explicitly untested. Initial code saving has an explicit skip path with the consequences stated. No developer tools or registration form is required.

Deletion requires fresh proof and an unchecked explicit confirmation. It explains permanent deletion of server account data and progress, session revocation, and the unaffected identity inside the signer. The local copy is kept by default. Requested local removal is allowed only when the confirmed server document still covers the latest device copy. Unconfirmed or foreign work is kept and explained. Deletion releases only the deleted account's ownership marker on a kept copy, allowing a later consent-based transfer. Sign out everywhere retains local copies and explains that remote copies cannot be erased by ending sessions.

## Persistence status and correctness finding

A compact polite live status below lesson completion distinguishes local saving, confirmed account saving, pending work, connectivity loss, consent, a foreign account's copy and a session that ended. It shows no account identifier and adds no polling. Anonymous status is server-rendered. The existing lazy sync module updates the signed-in status; an expired-session marker keeps the pause visible across lesson reloads without more requests. Blocked local storage still shows the existing persistence failure message.

Review found that Stage 3 could return `synced` after withholding invalid/future timestamps or retaining a write made during the request. Its account panel also treated a busy lock as saved. These were misleading, and sign-out could consequently discard a value that the server never accepted. Stage 4 compares the confirmed response with the latest canonical local document. Incomplete coverage remains `pending` and dirty, and cannot authorize local removal. A fresh write after the final sync is rechecked after logout. Withheld values do not create an endless retry timer. The add-only merge, version 1 file format and server rules are unchanged.

The full two-tab browser test caught a Stage 4 regression before commit: the new status listener initially reacted to every storage event. `getStorage()` checks availability by writing/removing `jifunze:probe`; reacting to that event made the tabs repeatedly read and probe each other's storage, freezing interaction. Bringing the tab to the foreground alone did not resolve it. The listener now accepts only account/owner/progress/dirty/status changes or an actual storage clear, and explicitly ignores probes and unrelated keys. A new unit regression verifies that filter; the real browser flow must also pass before the stage is accepted. No timeout, forced click or assertion relaxation is used.

## Security findings and limits

- No private-key, seed or signer-password input is added. The recovery form rejects secret-shaped text locally. A signer response is validated field by field and serialized as standard public event fields only; template mutation is rejected before submission.
- Fresh proof alone never executes a sensitive action. Deletion needs an additional checkbox; replacement names its effects before approval. Backend freshness and challenge checks remain the authority.
- Recovery credentials are never put in URL parameters, browser storage or logs by these controls. Page-hide clears the displayed replacement codes from component state; deliberate downloads are private files the learner must protect.
- A lost sensitive-action response can conceal a completed server transaction. The UI disables repeat confirmation and directs the learner to check the account. It cannot recover a response's one-time codes; a fresh proof and new code set are the remedy.
- Browser storage remains the Stage 3 persistence mechanism. Independent writes within the same few milliseconds still have the existing theoretical race; tests cover stale tabs and changes during a sync, not every possible interleaving.
- A kept copy after ordinary sign-out retains its non-secret owner marker. Shared-device privacy still depends on the learner's choice to retain a copy. Stage 4 echoes the known account ID to the same-origin API only as `X-Jifunze-Account`, an expectation that must match the cookie. It is not a token, account selector, body field or displayed status value; it is never sent to a relay or third-party service.
- A page check alone cannot prevent a session change between the check and the mutation. The optional expectation header is checked on the actual request before any handler. A mismatch gives `409 account_changed`, preserves device work and asks for a reload; a header without a live cookie gives `401`. The browser race regression deliberately swaps to a second real account's cookie after the first account's check and verifies that the second account is not deleted. The same condition protects progress uploads. Existing clients without the optional header retain their original cookie-scoped contract.
- Review found that the API request logger included an account ID despite the documented path/status-only policy. That field and its logger type have been removed. A new authenticated-request regression checks that logs contain only method, route, status and duration, with no account, cookie or expectation identifier. This is a correction to the existing logger, not a claim of a completed qualified privacy review.
- Automated fake-signer tests do not establish real signer or phone support. Privacy review, live-device acceptance and production proxy evidence remain separate.

## Validation

Logs and Playwright traces are retained locally under `.superpowers/stage4-account/` and are not release artifacts. Node 24.20.0 and npm 12.0.2 were used.

| Check | Result |
| --- | --- |
| `npm run check` | Lint, frontend types, 207 unit tests and content validation pass; content has 0 errors and 101 existing warnings |
| `npm run api:typecheck` / `npm run api:test` | API types pass; 330 tests pass, including the PostgreSQL suites and five new request-condition/logging regressions |
| Complete `npm run e2e:account -- --workers=1` | 39/39 pass in one clean serial run on the final account implementation |
| `npm run e2e:learner-account` | 7/7 pass together against the real API/PostgreSQL: both languages, wrong/rejected/expired proof, code rotation, lost-key recovery, revocation, deletion, local retention, keyboard, 360px layouts, stale-account deletion, occupied key, and a lost response |
| `npm run e2e:allowlist` | 12/12 pass |
| Focused public browser regression | 81 pass, 29 existing project skips, 0 failures across desktop/mobile; see scope below |
| Account export and UX budgets | Production-mode account build, postbuild checks and all unchanged initial JavaScript limits pass |
| Final production-origin export | Build, postbuild and UX budgets pass; 130 indexable pages and 10 non-interactive account pages; 914 files pass the origin/credential-pattern scan |
| Final production runtime isolation | 242 checks pass in the actual local nginx runner; API paths remain blocked and the disposable container was removed |
| Final anonymous browser recheck | 4/4 pass after all source changes, both languages on desktop/mobile; no account request, no sync download and no stored sync state |

Public browser scope: `a11y`, `budget`, `discussion`, `housekeeping`, `interaction`, `lesson`, `practice`, `progress-anonymous`, `progress-tabs`, `public-release`, `quiz` and `roadmap`. This is an affected-flow regression, not a claimed rerun of the entire public suite. It passed before the final account-only request-condition changes; the final anonymous export, isolation checks and anonymous browser cases are checked again after those changes. Automated mobile layouts are Chromium viewports, not real phone acceptance. English/Kiswahili confirmation screenshots were inspected.

Earlier attempts caught ambiguous Next.js announcer selectors, a fixture switching its signer before re-authentication completed, a local-origin environment mistakenly applied to a production metadata unit test, and the actual storage-probe feedback bug described above. Selectors and fixture sequencing were corrected, checks used their intended environments, and the storage listener was fixed. The final complete account result is a single clean run; it is not assembled from failed runs and isolated reruns.

### Measured performance

Gzip KiB, rounded to three decimals; English and Kiswahili use the same initial JavaScript assets. Limits were not increased.

| Account-enabled export | Measured | Existing limit |
| --- | ---: | ---: |
| Lesson JavaScript | 146.996 | 147.3 |
| Account home JavaScript | 150.503 | 151 |
| Sign-in JavaScript | 150.765 | 151 |
| Sign-out JavaScript | 149.622 | 151 |
| Recovery JavaScript | 149.656 | 151 |
| Welcome JavaScript | 149.316 | 151 |
| Lab JavaScript maximum | 153.02 | 153.2 |
| Tree JavaScript maximum | 144.50 | 145.1 |
| First Kiswahili lesson total | 181.158 | 200 |

Relative to Stage 3's reported 146.93 KiB, lesson JavaScript grew by about 0.07 KiB. Account controls (about 5.84–5.91 KiB) and sync chunks (about 3.87–4.84 KiB, depending on the emitted entry) are loaded on demand and are outside initial page loads. Anonymous browser checks verify that no sync module is requested. All catalogue, home, roadmap and simulation initial limits also pass. The six desktop activated simulation cases retain their 150 KiB total / 6 KiB added-script limits; their mobile duplicates remain skipped by the existing suite.

The compatibility account suite and learner lifecycle suite run sequentially against separate fresh API processes because their legitimate recovery attempts exceed the production per-source limit when combined. No limiter is bypassed or increased. CI runs both, with the compatibility suite serially.

## Kiswahili review

All new account security copy, modified sign-in/recovery errors and guidance, revised backup instructions, and persistence statuses are recorded as pending review in `content/terminology-review.json`. The pre-existing pending key-mismatch translation was checked for consistent use of the account's existing identity in the re-authentication flow; no language approval is invented. Review must preserve the distinctions between account recovery and secret-key restoration, existing versus replacement identity, code rotation, server deletion versus device retention, consent, and expired-session saving.

## Remaining gates and Stage 5

Stage 4 implementation and the checks above are complete. Stage 5 can build NIP-46 against the existing proof interface. It must keep client secrets in attempt memory, load phone-signing code only on demand, carry the known-account request condition through its proof sender, and retain the accepted design's two-signer and low-end Android interoperability acceptance. No real signer or phone has been accepted here.

Before staging or production: explicit authorization for push/PR/deployment, pending Kiswahili review, an allowlisted staging switch with a fresh account count and live signer acceptance, qualified privacy review and retention decision, production client-address/proxy and logging evidence, backup restore and rollback rehearsals, and a separate production release decision. Production account activation remains disabled.
