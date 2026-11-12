# Nostr-first identity and persistent learning: design

Date: 12 November 2026. Baseline: `main` at `3ec6b0d077811eefacc0ebf43595b916e4449040`.

Status: **design accepted by the maintainer on 12 November 2026, with conditions** recorded in section 10. Nothing here is deployed or enabled. Production remains the anonymous static site. Conditional decisions are not verified until the stated evidence exists.

This document narrows the [Phase 3 design](2026-11-04-phase-3-design.md). Where the two differ, this one applies to learner accounts; Phase 3 decisions it relies on (D2 architecture, D6 mobile Nostr, D9 recovery, D11 dependencies, D13 retention) are referenced, not repeated.

## 1. Principles

1. **Learning never needs an account.** Anonymous reading, quizzes, discussion confirmation, offline use and on-device progress stay exactly as they are.
2. **Nostr proves who you are; the platform keeps your progress.** The server sees a public key and a signature. It never sees, asks for, generates or stores a secret key, seed phrase or signer password.
3. **Progress is local first.** The browser copy is always complete and usable. The server copy is a second copy that follows it. Losing the account or the key never destroys what is on the device or in an export file.
4. **Private progress stays private.** It lives in PostgreSQL behind the session, never on Nostr relays, never in public profiles.
5. **Nothing is measured that is not needed.** No third-party analytics, no per-learner tracking beyond the progress the learner chose to save.

## 2. Existing architecture assessment

### 2.1 Reusable as it stands

| Area | Where | Assessment |
| --- | --- | --- |
| Nostr proof verification | `api/src/nostr.ts` | Strict NIP-98 event check (kind 27235, exact `u`, `method`, `payload` tags, 60-second window, canonical base64, BIP-340 via `@noble/curves`). Pure function with fixtures. Reuse unchanged. |
| Challenge and sign-in | `api/src/nostr-routes.ts`, `challenges.ts`, `signInWithNostr` | Single-use hashed nonce bound to a pre-auth cookie, five-minute expiry, consumed in the same transaction that creates the account and session. A proven key is the only identifier and never attaches to an existing session's account. Reuse; generalise the challenge purpose (section 3.4). |
| Sessions | `api/src/sessions.ts` | 32 random bytes in a `__Host-` `HttpOnly; Secure` cookie; only the SHA-256 is stored; 14 days idle, 30 days absolute; daily purge; logout revokes. Reuse. |
| Recovery codes | `api/src/recovery.ts` | Ten single-use 80-bit codes, stored as peppered HMACs with pepper versions, per-source rate limits, flood reporting, short `recovery` session scope. Reuse; this is the lost-key path. |
| Request controls | `api/src/http.ts` | Exact `Origin` match plus required `X-Jifunze` header on every non-GET, JSON content type, 16 KiB body cap, route-template-only logging. Reuse. |
| Schema | `api/migrations/0001_accounts.sql` | `accounts`, `identities` (provider `nostr`, hex public key), `sessions`, `auth_challenges`, `security_events`, `recovery_codes`. Reuse; add one table. |
| Progress model | `lib/progress/model.ts` | Version 1 document keyed by `roadmap/slug`, which is already language independent. `mergeProgress` only ever adds: earliest completion, earliest discussion confirmation, best quiz, union of lab passes. It is commutative, associative and idempotent. This is the conflict-resolution rule for the server too. |
| Multi-tab safety | `lib/progress/useProgress.ts` | Each write merges the latest stored copy first (the stale-tab correction in PR #12). |
| Client pieces | `components/account/NostrSignIn.tsx`, `NostrOnboarding.tsx`, `api.ts` | NIP-07 sign-in with field-by-field checking of what the signer returns, and beginner guidance that already forbids entering a secret key. Reuse and extend. |
| Hosting split | `docker/nginx.conf`, `docker/railway-entrypoint.sh` | Static site with a same-origin `/api/` proxy; production runs in `static` mode and answers every `/api` path with 404. The service worker ignores `/api/`. Reuse. |

### 2.2 Incomplete or missing

| Gap | Evidence | Consequence |
| --- | --- | --- |
| API cannot start without GitHub credentials | `REQUIRED` in `api/src/config.ts` includes `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` | A Nostr-only deployment needs GitHub secrets it never uses. |
| A Nostr-only account has no recovery outcome | `replaceGithubIdentity` throws `nostr_lifecycle_pending`; the recovery page shows "not available yet" | Recovery codes can open a recovery session that then cannot do anything useful. |
| Re-authentication is GitHub only | `reauth` exists only as a GitHub challenge purpose | A Nostr-only learner cannot pass the freshness check for regenerating codes. |
| No account deletion | No route writes `accounts.deleted_at` or removes an account | Learners cannot remove their data. |
| No server-side progress | No table, no route; progress exists only in `localStorage` | No cross-device learning. |
| No mobile signing path | Only NIP-07 (`window.nostr`) is implemented; NIP-46 was approved with conditions (D6) and not built | Most phone learners cannot sign in. |
| Accounts are switched by origin | `ACCOUNTS_AVAILABLE = !SITE_INDEXABLE` in `lib/site.ts` | Accounts can never be enabled on the production origin without a code change; this is a deliberate guard that must be replaced deliberately. |
| Production forbids account mode | Entrypoint: "production requires static mode"; staging trusts all private peers for the client address (`isolated-staging`) | An authenticated production deployment needs its own proxy trust decision (section 8). |
| Rate limits are in memory | `api/src/ratelimit.ts` | Correct for one API replica only. |
| No live signer acceptance | Staging authentication has stayed disabled; tests use fake signers | No signer app may be named as supported yet. |

GitHub contributor discovery (Phase 3 section G) is designed but not implemented. Nothing in this design removes it; section 3.6 keeps the door open.

## 3. Nostr-only account design

### 3.1 Three separate things

| Step | What it is | What proves it |
| --- | --- | --- |
| **Authentication** | Showing control of a Nostr key, for this site, now | A signed NIP-98 event over a fresh server challenge |
| **Account creation** | The first successful authentication by a key the server has not seen | Same proof; the server creates the account in that transaction |
| **Recovery** | Regaining the account after losing the key | A recovery code issued earlier, then a proof from a **new** key |

There is no registration form, username, password or email. An account is a row keyed to one public key.

### 3.2 Signing methods

| Method | Specification | Role | Status |
| --- | --- | --- | --- |
| Browser signer | NIP-07 `window.nostr.signEvent` | Desktop, and mobile browsers with an extension | Implemented |
| Remote signer app | NIP-46, using `nostr-tools/nip46` pinned and lazily loaded | Phones: scan or tap a `nostrconnect://` link, or paste a `bunker://` address | Approved in D6/D11 with conditions; build in stage 5 and release only after the phone and two-signer interoperability checks in Phase 3 section F3 |

Both end the same way: the browser sends one NIP-98 event to the server, which verifies it with the existing `verifyNostr`. The signing method changes nothing on the server.

Not offered, by design: typing or pasting a secret key, generating a key in the page, keeping any key in `localStorage`, `sessionStorage`, IndexedDB or a cookie, or "sign in with a seed phrase". The NIP-46 client key exists in memory for one attempt only.

### 3.3 Session, expiry and logout

Unchanged lifetimes: 14 days idle, 30 days absolute, one cookie per browser. Changes:

- **`SameSite=Strict`** for the session cookie once GitHub sign-in is not mounted. The site is static, so pages load without the cookie and then call the API same-site; nothing depends on the cookie arriving with a cross-site navigation. `Lax` was only needed for the GitHub redirect.
- **Sign out** revokes this session (exists).
- **Sign out everywhere** revokes all sessions for the account (`revokeOtherSessions` exists; add the route and button).
- The browser keeps a non-secret marker (`jifunze:account:v1`) so the sync code knows whether to try. It holds no token. A `401` clears it.

### 3.4 Challenge purposes for Nostr

Generalise `createNostrChallenge` and `consumeNostrChallenge` from the fixed `signin` purpose to three, each with its own verification URL so the signed `u` tag states the intent:

| Purpose | Route | Requires | Effect |
| --- | --- | --- | --- |
| `signin` | `POST /api/auth/nostr/verify` | nothing | Sign in, or create the account (exists) |
| `reauth` | `POST /api/auth/nostr/reauth` | full session; proof from the account's own key | Sets `reauth_at` on this session |
| `replace` | `POST /api/auth/nostr/replace` | recovery session, or full session with fresh `reauth` | Replaces the account's Nostr key (3.5) |

`auth_challenges` already has the `purpose`, `account_id` and `session_token_hash` columns and the check that non-sign-in purposes carry the initiating session.

### 3.5 Recovery and key replacement

Recovery codes are offered once, right after the first sign-in, on the existing welcome page, and can be regenerated after re-authentication.

| Situation | Path | Result |
| --- | --- | --- |
| Signer reinstalled, key restored from the signer's own backup | Sign in normally | Same account; nothing to do |
| Key lost, recovery code available | Enter a code → 15-minute recovery session → set up a signer with a new key → approve the `replace` request | Same account and progress under the new key; every session revoked and a fresh one started; the old key can no longer reach the account; every earlier recovery code stops working and a new set is returned once in the same transaction; a security event is recorded |
| Key lost, no code, progress still on a device | Create a new account with a new key; the device's progress merges into it (section 4.4) | New account with the same progress |
| Key lost, no code, no device copy, export file kept | New account, then import the file | New account with the exported progress |
| Key lost, nothing kept | New account | Progress is gone; the old account is unreachable and expires under the retention rule in 3.7 |
| Key suspected stolen, learner still signed in | Re-authenticate, replace the key, sign out everywhere | Thief's sessions end; old key rejected |

`replace` runs in one transaction, modelled on `replaceGithubIdentity`: lock the account, consume the challenge, reject a key that already belongs to another account (`identity_in_use`), swap the identity row, revoke other sessions, write the event. The concurrency tests that exist for the GitHub version are the template.

The platform cannot recover a Nostr key and says so. It recovers the **account**.

### 3.6 GitHub becomes optional

- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` leave `REQUIRED`. `githubRoutes()` is mounted only when both are present; without them every `/api/auth/github/*` path is the ordinary 404.
- Nostr is the only sign-in and the only recovery target for learner accounts.
- The `identities` table keeps the `github` provider. When contributor discovery (Phase 3 section G) is built, GitHub attaches to an existing Nostr account as a **linked** identity for the public builder profile. It is not a sign-in method and not a recovery method. Public GitHub repository links on the Builders pages are unaffected.
- The existing GitHub code and tests stay in the repository and run in CI with the fake GitHub, so the module does not rot.

**Decision A (verified 12 November 2026):** a read-only aggregate query on the staging database returned 0 accounts, 0 identities, 0 live sessions and 0 recovery codes. No GitHub-only account exists, so no migration is needed. Only counts were read; no identifier was displayed or stored. Repeat the count immediately before the staging switch.

### 3.7 Deletion and retention

- `POST /api/me/delete` (full session, fresh re-authentication): removes the account row; `identities`, `sessions`, `recovery_codes`, `auth_challenges` and progress go with it by `on delete cascade`; `security_events.account_id` becomes null as the schema already provides. The device copy is the learner's to keep or clear.
- **Decision B (pending privacy review):** inactivity retention. Proposed: an account with no session activity and no progress update for 24 months is deleted by the daily purge. The learner's export file and device copy are unaffected.

## 4. Beginner onboarding and recovery model

The audience includes people who have never held a key. The design does not pretend that is simple; it removes every step that is not essential and never trades safety for speed.

1. **Default: no account.** The site says plainly that progress is saved on this device and can be downloaded as a file. Most learners stop here.
2. **Offer, not a gate.** "Keep your progress on more than one device" appears on the progress page and the account page. Lessons never prompt for it.
3. **Two honest choices** on the sign-in page (the existing radio choice):
   - *I already have a Nostr signer* → Continue with Nostr.
   - *I am new to Nostr* → three steps, shown before any button is active:
     1. Install a signer app. The page lists only signers that have passed the project's live check; until one has, it explains what a signer is and links to the signer's own guide, marked as untested, as today.
     2. Back up the key **in the signer**, following the signer's instructions, before continuing. Jifunze shows no key, asks for none and cannot restore one.
     3. Return and approve the sign-in request.
4. **Right after the first sign-in:** recovery codes, with one sentence on what they are for ("if you lose your signer, these let you attach a new one"), a download and print option, and a confirmation tick. Skipping is allowed and stated honestly: without codes, a lost key means a new account.
5. **Savings groups and shared phones:** the page states that each learner needs their own signer and that signing out removes that learner's progress from a shared device (section 5.5).

Key backup guidance is one consistent message in both languages: the public identity (`npub`) can be shared; the secret key (`nsec`), seed words and signer password are never typed into Jifunze or sent to anyone; a backup kept only on the same phone is not a backup.

New and changed Kiswahili terms go through the existing terminology review record before release.

## 5. Progress synchronisation

### 5.1 Schema (migration `0002_progress.sql`)

```sql
create table lesson_progress (
  account_id   uuid not null references accounts(id) on delete cascade,
  lesson_key   text not null check (lesson_key ~ '^(savers|builders|lightning)/[a-z0-9-]{1,80}$'),
  completed_at timestamptz,
  reflected_at timestamptz,
  quiz_correct smallint check (quiz_correct >= 0),
  quiz_total   smallint check (quiz_total >= quiz_correct),
  quiz_at      timestamptz,
  lab_passed   text[] not null default '{}',
  updated_at   timestamptz not null default now(),
  primary key (account_id, lesson_key),
  check ((quiz_correct is null) = (quiz_total is null) and (quiz_correct is null) = (quiz_at is null))
);
```

One row per account and lesson. Lesson keys are the existing `roadmap/slug` identifiers: language independent and unchanged. No answers, no discussion text, no reading time, no device or language data.

### 5.2 API contract

Both routes require a **full** session; a recovery session is refused. The account is always the session's; no route accepts an account identifier.

| Route | Request | Response |
| --- | --- | --- |
| `GET /api/me/progress` | none | `200` with a version 1 document: `{ "app": "bitsacco-jifunze", "version": 1, "lessons": { … } }` |
| `POST /api/me/progress` | A version 1 document containing some or all lessons | `200` with the account's full merged document |

- The body is validated with the same rules as `parseProgressFile`: known app and version, key pattern, integer scores, lab identifiers of at most 64 characters. Extra limits: 500 lessons per account, 100 lab identifiers per lesson, 64 KiB body for this route only.
- Timestamps must be in the exact form the application writes, `YYYY-MM-DDTHH:MM:SS.sssZ` (UTC, milliseconds). Any other form is rejected with `400`; the client normalises an imported file before sending. A timestamp more than five minutes ahead of the server clock is also rejected, never rewritten. Section 5.3 explains why.
- Quizzes are limited to 1,000 questions, and timestamps to the years 2000 to 2999.
- Unknown but well-formed lesson keys are stored, so a renamed or retired lesson does not make a learner's file unsyncable.
- `POST` is a merge, never a replacement, and is idempotent: sending the same document twice changes nothing.
- Rate limit: 60 merges and 120 reads per minute per account. Responses are `Cache-Control: no-store`.

### 5.3 Conflict resolution

The server applies the same rule as `mergeProgress`, per lesson, in one statement:

```sql
insert into lesson_progress as p (account_id, lesson_key, completed_at, reflected_at, quiz_correct, quiz_total, quiz_at, lab_passed)
values ($1, $2, $3, $4, $5, $6, $7, $8)
on conflict (account_id, lesson_key) do update set
  completed_at = least(p.completed_at, excluded.completed_at),
  reflected_at = least(p.reflected_at, excluded.reflected_at),
  quiz_correct = case when KEEP then p.quiz_correct else excluded.quiz_correct end,
  quiz_total   = case when KEEP then p.quiz_total   else excluded.quiz_total   end,
  quiz_at      = case when KEEP then p.quiz_at      else excluded.quiz_at      end,
  lab_passed   = (select coalesce(array_agg(distinct x order by x), '{}') from unnest(p.lab_passed || excluded.lab_passed) x),
  updated_at   = now()
```

`KEEP` is true when the stored quiz stays. With `n(q) = correct if total > 0 else 0` and `d(q) = total if total > 0 else 1`:

```sql
excluded.quiz_at is null
or (p.quiz_at is not null and (
     n(p) * d(excluded) >  n(excluded) * d(p)
  or (n(p) * d(excluded) = n(excluded) * d(p)
      and (p.quiz_at < excluded.quiz_at
           or (p.quiz_at = excluded.quiz_at and p.quiz_total >= excluded.quiz_total)))))
```

Consequences:

- **A stale update cannot delete anything.** There is no operation that clears a field. An old tab, an old device or a replayed request can only add what it knows.
- **Concurrent updates converge.** Each lesson merges atomically under the row lock; different lessons never contend. A document's lessons are applied in sorted key order so two requests cannot deadlock.
- **No version numbers, ETags or "last write wins".** They are unnecessary for a merge that only grows.

A deliberate limit: progress cannot be "un-completed" by sync. Resetting progress is a separate, explicit action (clear this device; delete the account).

#### Verification against the client (12 November 2026)

Before any persistence code, the statement above was run on a throwaway local PostgreSQL 16 database against generated pairs of version 1 documents and compared with the real `mergeProgress` from `lib/progress/model.ts`. This was a design check, not an implementation; the database was dropped afterwards.

| Check | Result |
| --- | --- |
| Server(A then B) equals `mergeProgress(mergeProgress(empty, A), B)` | 1,500 of 1,500, including 40 exact quiz ties |
| Posting the same document twice | No change in 300 of 300 |
| Order independence, excluding exact quiz ties | 776 of 776 identical |
| Eight documents posted in parallel to one account, 120 rounds | No field lost or wrong |
| `least` with one null; with both null | Keeps the value; stays null |
| Millisecond timestamps through `timestamptz` | Exact round trip |

Rules examined, with what the server must do to match:

| Rule | Client behaviour | Server requirement |
| --- | --- | --- |
| Completion and discussion timestamps | Earliest wins, compared as **text** | Identical only when both are in the canonical UTC form, where text order equals time order. **Mismatch found:** for `2026-11-01T10:00:00+03:00` and `2026-11-01T08:00:00.000Z` the client keeps the second (smaller text) and the database keeps the first (earlier instant). Hence the canonical-form rule in 5.2. |
| Quiz comparison | Higher `correct / total`; a total of 0 counts as ratio 0 | Integer cross-multiplication with the zero-total case handled as above. **Mismatch found in the first draft of this design:** plain cross-multiplication treats `0/0` as tying with every score. Corrected here. Totals are capped (`smallint`), so two different ratios cannot collide. |
| Quiz tie-break | Equal ratio: the earlier attempt wins. Equal ratio **and** equal timestamp: the copy already held wins | Same: the stored row wins. **Existing client property, not a server defect:** in that exact case (for example 1/2 and 2/4 at the same millisecond) `mergeProgress` depends on argument order, in 24 of 800 generated cases. Two devices could then show different numbers for the same ratio indefinitely. It cannot lose progress. **Decided and implemented in Stage 2:** when the ratio and the timestamp are both equal, the result with more questions wins, on the device and on the server alike. The merge is then a total order and property tests confirm it is commutative, associative and idempotent. |
| Lab passes | Union, in insertion order | Union, sorted. Equal as sets; order carries no meaning. The response omits `lab` when the set is empty, as the client does. |
| Missing values | Absent fields stay absent | `least` ignores nulls; the quiz columns stay null together. |
| Future-dated timestamps | Kept as written | **Rejected, not rewritten** (changed from the first draft): rewriting would make the server differ from the device copy. |
| Derived completion | `mergeProgress` never derives completion from lab passes or discussion | The server must not derive or require anything either; historical completions without a discussion timestamp stay valid. |
| Lesson keys | `[a-z0-9-]+`, any length | Capped at 80 characters; longer keys are rejected. No current slug approaches this. |
| Lab identifiers | Any string up to 64 characters | Same, and a NUL character is rejected because PostgreSQL text cannot hold it. |

### 5.4 Client behaviour

- `localStorage` under `jifunze:progress:v1` stays the copy the interface reads. The version 1 format, import and export are unchanged.
- When the account marker is present, a small sync module is loaded with a dynamic `import()`. Signed-out pages load no sync code and make **no** `/api` request.
- Sync runs after sign-in, after a local write (debounced about two seconds, sending only the lessons that changed), when the page becomes visible, and when the browser comes back online. Each run posts, merges the response into local storage with `mergeProgress`, and clears the dirty list.
- **Offline:** writes land locally and are marked dirty; they are sent on the next run. Nothing blocks reading or completing lessons.
- **Several tabs:** all tabs share the stored copy and the dirty list. Two tabs sending the same lessons is harmless because the merge is idempotent.
- **Signed out by expiry (`401`):** the marker is cleared, local progress is kept, and the account page shows a calm "sign in again to keep saving to your account".
- **Budget:** lesson pages are at 146.77 of 147.3 KB initial JavaScript. The sync module must stay out of the initial bundle and the limits must not be raised to fit it.

### 5.5 Whose progress is on this device

Chama members share phones. The device copy therefore carries an owner (`jifunze:progress:owner`: empty for anonymous, otherwise the account identifier).

| Device copy | Who signs in | Behaviour |
| --- | --- | --- |
| Anonymous | Any account | Ask once: "Add this device's progress to your account?" Yes merges; No leaves the device copy anonymous and untouched until sign-out |
| Same account | That account | Merge silently |
| Another account | A different account | Never merge. Offer to download the existing copy, then replace it with the new account's progress |

At sign-out the learner chooses between removing their progress from this device (default once sync has succeeded) and keeping it. If there are unsent changes and no connection, the page says so and keeps the copy.

### 5.6 Migration

- Existing learners change nothing. Their stored document is already the format the server accepts.
- The first sign-in on a device uploads its progress through the ordinary merge. There is no bulk migration and no data conversion.
- Historical completions without `reflectedAt` remain complete, exactly as today.
- The database migration only adds a table. It can be applied before any code uses it and left in place if the feature is switched off.

## 6. Minimal analytics

**What is needed:** whether lessons are being completed, where learners stop within a path, and whether quizzes are too hard. Nothing about individuals.

| Metric | Source | Granularity |
| --- | --- | --- |
| Accounts that have saved progress | `lesson_progress` | one number |
| Accounts with any progress update in a week | `updated_at` | per week |
| Completions per lesson; share of path starters who reach each lesson | `completed_at` | per lesson |
| Median quiz ratio per lesson | quiz columns | per lesson |
| New accounts per week | `accounts.created_at` | per week |

Rules:

- **Aggregates only, from data the learner already chose to store.** No event stream, page-view tracking, device fingerprint, referrer capture, cookie or third-party script is added.
- **Anonymous learners are not measured.** The only information about them is what the host already shows for any website: request counts and transfer, with addresses truncated in the NGINX logs. The documentation says this openly rather than implying fuller insight.
- **Small numbers are suppressed:** any cell under five is reported as "fewer than 5".
- **Access:** no public or in-app endpoint. A maintainer runs one reviewed, read-only SQL report through a database role that can `select` aggregates only. Output is counts, never rows, public keys or account identifiers.
- **Individual progress** is visible to the learner alone. There is no educator, group or administrator view of a person's progress in this design.
- **Deletion:** a deleted account disappears from the next report. Saved report outputs contain only aggregates.
- **Retention:** live data follows account retention (3.7). **Decision C (approved):** aggregate snapshots only, kept at most 24 months, in the maintainers' private operations notes, not in the database.
- **Decision D:** a privacy notice in both languages is required before accounts open, and the applicable data-protection duties for storing a public key with learning records need review by someone qualified. This design does not claim compliance.

## 7. Feedback over Nostr

The smallest useful mechanism is a link that hands the learner to their own Nostr app.

- A build-time setting, `FEEDBACK_NOSTR_NPUB`. The build fails if it is set to anything that is not a valid NIP-19 `npub` (checksum included). If unset, no Nostr feedback link is rendered. No key is hardcoded in the repository.
- The feedback section shows: a `nostr:npub1…` link (NIP-21) that opens the learner's Nostr client on the maintainer's profile, the `npub` as text with a copy button, and one line of guidance ("send a public note or a private message from your own app; never send secret keys or recovery codes").
- **Optional verification (Decision E):** publish `/.well-known/nostr.json` (NIP-05), generated at build from the same setting, so a client can show the maintainer as `feedback@bitsaccojifunze.xyz`. This ties the key to the domain without any server code. It needs one NGINX location with `Access-Control-Allow-Origin: *` for that file only.
- Not built: in-site messaging, relay connections, inbox, encryption code or message storage. Private messaging, if the learner wants it, is whatever their client implements.
- GitHub issues remain the channel for contributors.

**Decision F:** which key is the maintainer's feedback identity, and who controls it.

## 8. Production security requirements

Production today has no API, database or secrets. Each requirement below must be met and evidenced before that changes; none is met merely by passing CI.

| Area | Requirement |
| --- | --- |
| Deployment separation | Three services in the production environment: public `web` (NGINX), private `api`, private PostgreSQL. Only `web` has a public domain. The API listens on the private network only; the database has no public TCP proxy. Staging is never cloned into production and no staging variable is copied. |
| Reverse-proxy boundary | The API takes the client address only from NGINX. Production needs its own documented trust decision for the address NGINX receives from the host's edge; the `isolated-staging` exception does not apply. Until that is accepted, per-address limits must be treated as possibly one shared bucket and the sensitive routes must also be limited per account or per challenge. (**Decision G**) |
| Session cookie | `__Host-` prefix, `Secure`, `HttpOnly`, `Path=/`, `SameSite=Strict`; HTTPS only; HSTS stays on. |
| CSRF and origin | Keep the exact `Origin` match and required custom header on every state-changing request; additionally reject when `Sec-Fetch-Site` is present and not `same-origin`. No state change on `GET`. |
| API authorisation | Every `/api/me/*` query is scoped by the session's account. No account identifier in any path, query or body. Recovery sessions reach only recovery routes. Tests prove one account cannot read or write another's progress. |
| Content security | `connect-src 'self'` on every page; `wss:` only on the sign-in page and only when the NIP-46 stage ships, under the D11 conditions. No third-party scripts. |
| Rate limiting | Existing limits on challenge, verify and recovery; new limits on progress merges and deletion. One API replica while limits are in memory; a second replica requires a shared limiter first. |
| Database | A runtime role with data access only; schema changes applied by a separate owner role as a release step. TLS to the database. Encrypted, off-service daily backups with a restore actually tested before launch. |
| Secrets | `DATABASE_URL` and `RECOVERY_PEPPER_V1` on the API service only; never in the web service, a build argument, the repository, logs or chat. Pepper rotation uses the existing versioning. |
| Logging and privacy | Route templates and truncated addresses only. Never a public key next to a learning event, never a request body, cookie, code or query string. |
| Monitoring | External checks on `/en/` and `/api/health`; alerts on API 5xx rate, database errors, recovery-flood events and failed deployments, delivered to a channel a maintainer actually reads. Production currently has none of these. |
| Enablement switch | Replace `ACCOUNTS_AVAILABLE = !SITE_INDEXABLE` with an explicit build setting, and change the entrypoint's "production requires static mode" guard, in one reviewed change made only after the acceptance above. |
| Rollback | The web service can return to the static image at any time; learners keep working from the device copy and lose nothing. Database migrations are additive, so the previous API image runs against the newer schema. A rollback is rehearsed on staging before production. |
| Acceptance before production | Live sign-in with at least two real signers (one on a low-end Android phone), recovery and key replacement end to end, cross-device sync, deletion, a restore from backup, and a review of logs for leaked identifiers, all on staging with the tester allowlist. |

## 9. Implementation stages and tests

Each stage is one reviewable pull request and leaves production untouched until stage 7.

| Stage | Scope | Tests that must exist |
| --- | --- | --- |
| 1. Nostr-only API | GitHub optional in config and routing; Nostr `reauth`; Nostr `replace` from recovery; sign out everywhere; account deletion; `SameSite=Strict` | API boots with no GitHub variables and GitHub paths are 404; reauth accepts only the account's own key; replace rejects a key in use, is single-use, revokes other sessions and is safe under concurrent attempts; deletion cascades; existing GitHub suite still passes with the fake provider |
| 2. Progress API | Migration `0002`; `GET` and `POST /api/me/progress` | Server merge equals `mergeProgress` for generated pairs of documents; repeated and reordered posts give the same result; parallel posts to one lesson lose nothing; a stale document cannot remove a completion, discussion confirmation, quiz or lab pass; other accounts and recovery sessions are refused; size, count and timestamp limits; cascade on deletion |
| 3. Client sync | Lazy sync module, owner marker, dirty list, sign-in merge prompt, sign-out choice | Two browser contexts converge; offline changes arrive after reconnect; two tabs do not lose work; a different account on the same device does not inherit progress; signed-out pages make no `/api` request; lesson, tree and lab initial-JavaScript limits unchanged |
| 4. Onboarding and recovery pages | Beginner steps, recovery-code moment, key replacement flow, bilingual copy and terminology review | Keyboard and automated accessibility checks in both languages; no input on any page accepts an `nsec`; recovery flow end to end with a fake signer |
| 5. Phone signing (NIP-46) | As approved in D6/D11 | The Phase 3 section F3 test list; `wss:` appears only in the sign-in page's policy; released only after real-device interoperability |
| 6. Metrics and feedback | Read-only report and role; `FEEDBACK_NOSTR_NPUB`; optional NIP-05 file | Report returns no identifiers and suppresses small cells; build fails on an invalid `npub`; no link rendered when unset |
| 7. Production enablement | Section 8 in full | Staging acceptance record; backup restore record; rollback rehearsal; then a separate release decision |

Stages 1 to 4 can be completed and exercised on staging behind the tester allowlist without any production change.

## 10. Decision register

Maintainer direction recorded on 12 November 2026. "Conditional", "pending" and "open" entries are **not** verified until the stated evidence exists.

| | Decision | Direction | State |
| --- | --- | --- | --- |
| A | Unmount GitHub sign-in on staging | Approved on condition that staging holds no GitHub-only account | **Condition met:** the staging count on 12 November 2026 was 0 accounts (section 3.6). Recount immediately before the switch. |
| B | Inactive-account retention | 24 months proposed | **Pending** privacy review |
| C | Analytics retention | Aggregates only; kept at most 24 months | Approved |
| D | Privacy notice and qualified data-protection review | Required before public accounts | **Open**; no review has taken place |
| E | NIP-05 file for the feedback identity | Supported | **Conditional** on domain and key verification |
| F | Feedback identity | A dedicated Bitsacco Jifunze Nostr identity; public key configured later | **Open**; no key has been supplied and none is assumed |
| G | Production trust model for the client address behind the host's edge | Requires production evidence from the host | **Open** |
| H | Signer apps named in onboarding | None until live-device acceptance | Approved as a restriction |
| I | Sign-out on a shared device | Offer secure shared-device sign-out with safeguards that preserve unsynced local progress | Approved; design in section 5.5 |
| J | Facilitator access to an individual's progress | None | Approved |
| K | GitHub contributor discovery | Preserved as a separate future feature | Approved |

## 11. Out of scope

Public profiles and the builder directory, GitHub statistics, group or classroom features, in-site messaging, payments, publishing any learning data to relays, and any change to lesson content or the anonymous experience.
