# Phase 3: GitHub, Nostr and the builder ecosystem: design (revision 2)

**Status.** The product direction has **conditional design approval** (maintainer review, 2026-11-04). This revision:
- records the decisions;
- applies the five required corrections;
- adds findings from the investigations in [`spikes/2026-11-04-phase-3`](../spikes/2026-11-04-phase-3/README.md).

**Increment 2 has not started.** It is gated on the open items in section I.

Journey: **Jifunze → Jaribu → Jenga → Changia → Kua** (Learn → Practise → Build → Contribute → Grow).

---

## 0. Decision record

| ID | Decision | Maintainer outcome | How this revision applies it |
|---|---|---|---|
| D1 | Homepage polish onto `main` | **Approved** | **Done.** PR #5 merged as `254e757`; `main` now equals the reviewed polish tree, and CI is green. Phase 3 starts from this `main` |
| D2 | Architecture | **Approved with conditions** | Static learning site, same-origin Node API, PostgreSQL and the nginx `/api` proxy. **Public profiles are no longer generated statically** (section E2): privacy is enforced at request time |
| D2-nav | Navigation | **Approved** | Paths · Labs · Builders · Resources, plus language and account (section B) |
| D3 | Hosting and domain | **Provisional** | `jifunze.bitsacco.com` is the proposed domain until DNS and hosting are confirmed. Requirements, costs, deploys, secrets, backups and recovery are in section E5. Nothing is provisioned |
| D4 | GitHub App ownership | **Conditionally approved** | Long term: the Bitsacco org, after admin authorisation. Development: an isolated test App on a personal account. No org settings changed |
| D5 | No user-token storage | **Approved** | Tokens are used once for `GET /user` and discarded. Installation-token coverage is **unverified** (investigation 4 needs the test App). If it fails, this goes back for review; encrypted storage is **not** adopted automatically (section G4) |
| D6 | Nostr | **Approved with mobile requirements** | NIP-07 first; NIP-46 is the primary Android path, subject to interop and security assessment; NIP-55 is evaluated (section F3) |
| D7 | Directory membership | **Approved** | Only signed-up users who publish appear |
| D8 | Images | **Approved** | GitHub avatars only, from one allowlisted host; no Nostr images; generated fallback avatar |
| D9 | Recovery | **Requires revision** | One-time recovery codes plus a second identity. Lost-access deletion and unpublication obligations are covered. Presented for approval in section F5 |
| D10 | Ecosystem registry | **Approved** | A curated, broad, reviewable registry with no score (section G5) |
| D11 | API dependencies | **Provisionally approved** | `postgres`, `@noble/curves`, `@noble/hashes`, `zod`. `nostr-tools` is proposed only for the NIP-46 client on the sign-in route (section F3). The router is minimal, with explicit tests for its boundaries |
| D12 | Translation review | **Approved in principle** | No reviewers named yet. New terminology is tracked as **pending review** and not released as reviewed (section H2) |
| D13 | Retention | **Approved** | Security events kept 90 days; sessions and challenges purged daily; covered by tests (section F6) |

---

## A. Repository assessment (verified 2026-11-04)

- **`main` = `ee7b35b`**: v1, Phase 1, Phase 2, the review fixes and the CI prefetch fix. CI is green.
- **The homepage polish** (PR #4) landed on `feat/phase-2-ux` after that branch had merged. **PR #5** brought exactly those 21 files to `main`:
  - It merged as `254e757`, and `main`'s tree is byte-identical to the reviewed `88ca787`.
  - CI on `main`: success. On the PR: check passed (121 unit tests, 148 browser tests, 52 skipped), lab passed, and the simulation budget measured 142.375 KB.
- **Constraints** (unchanged from revision 1):
  - static export (`output: "export"`);
  - nginx container with no server, database or secret;
  - per-page hash-based CSP `<meta>` (`img-src 'self' data:`, `connect-src 'self'`, `form-action 'none'`);
  - service worker built around export paths;
  - JS budgets: home 143.43 of 144.9 KB, lesson 146.02 of 147.3, lab 151.94 of 153.2, simulation worst case 142.38 of 145;
  - the shared client dictionary (8.86 KB) is bundled into every page.

New findings since revision 1:

1. **Route collision.** `/{lang}/builders/` is already the *Bitcoin for Builders* path, and its lessons live at `/{lang}/builders/{lesson}/`. The builder directory and profiles move to **`/{lang}/community/`** and **`/{lang}/community/{handle}/`**. The nav label stays "Wajenzi / Builders".
2. **Stale service-worker copies.** The current worker keeps a page after the server returns 404, and serves it offline (investigation 2). This rules out caching profiles as pages and needs a worker fix (section E2).
3. **Single-language search.** "pochi" on `/en/learn/` and "seed phrase" on `/sw/learn/` return nothing today. Indexing both languages fixes both (investigation 5).

---

## B. Product design

The **identity** is unchanged from revision 1. The baobab grows through three layers:
- **Mizizi** (roots): learning.
- **Matawi** (branches): skills.
- **Matunda** (fruit): projects and verified contributions.

This shapes a single **Builder Journey** stem on each profile, drawn with plain CSS: no animation library, no score and no leaderboard.

The tokens, badges and freshness lines are unchanged:
- "Imethibitishwa na GitHub / Verified on GitHub" appears only on records fetched from GitHub.
- "Kutoka kwa mjenzi / Added by the builder" marks self-reported projects.

### Navigation (D2-nav approved), corrected for correction 4

```
Desktop ≥1024px
┌──────────────────────────────────────────────────────────────────────────────┐
│ (◎) Jifunze      Njia  Maabara  Wajenzi  Rasilimali ▾ │ Akaunti │ English    │
│     na Bitsacco                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
Phone <1024px:  (◎) Jifunze …  English  [≡ Menyu]   ← Akaunti is inside the menu
Rasilimali ▾ = Maktaba · Kamusi · Mazoezi · Maendeleo (a native <details>, like the phone menu)
```

- **Account access is one static link**, "Akaunti / Account", to `/{lang}/account/`.
  - That page checks the session through `GET /api/me` and shows either sign-in or the dashboard. The page itself has the avatar menu: Dashibodi, Wasifu wangu, Akaunti zilizounganishwa, Mipangilio, Toka.
  - **Measured:** a server-rendered header link adds **0.00 KB** of JS on every page type (investigation 5).
  - Revision 1's inline script and `jf_signed_in` cookie are **dropped**. They added executable code and a cookie for little gain.
- **The trade-off.** The header doesn't show who is signed in on learning pages. Anonymous learners make no account request at all, and signed-in users see their identity on the account pages.
- **Resources** uses a `<details>` disclosure like the phone menu, so it needs no new client code. Its exact JS cost is re-measured in Increment 2a, and the budget gate fails the build if it rises.

### Pages

| Route | Rendering | Notes |
|---|---|---|
| `/{lang}/account/` (signin, welcome, settings, signout) | static shell plus `/api` data | `noindex`; never cached by the service worker |
| `/{lang}/community/` | static shell plus a live list from `/api/public/builders` | Search and filters run in a route-local island |
| `/{lang}/community/{handle}/` | **static shell plus live data** from `/api/public/builders/{handle}` | nginx maps any handle to one shell per language (section E2) |

---

## C. User journeys

These are revision 1's journeys, with the corrections applied.

1. **Anonymous learner.**
   - Nothing changes, and no API request is ever made.
   - There is an optional "save progress to an account" prompt, but only on `/progress/` and at the end of a path.
2. **GitHub builder.**
   - The flow is: "Endelea na GitHub" → GitHub consent (no permissions) → callback → `/{lang}/account/welcome/`.
   - The welcome page shows **recovery codes once**, with a "Nimezihifadhi / I've saved them" confirmation (section F5).
   - Then the builder sets up a profile (handle, a bio in each language independently, skills, communication languages) and chooses a visibility (default **private**).
   - Publishing shows the profile **at once**, because it is served live (section E2).
3. **Nostr builder.**
   - With an extension: NIP-07.
   - On Android or without an extension: NIP-46 (a QR `nostrconnect://` or a pasted `bunker://`).
   - Then the same welcome and recovery-code steps as GitHub.
4. **Returning learner.** Merging local progress is explicit and uses the existing union and best-score rule. Local data is never discarded.
5. **Profile visitor.**
   - `/{lang}/community/` → a profile → evidence links to GitHub.
   - Viewing needs a connection. The page says so offline instead of showing a stale copy.
6. **Learner who lost access.**
   - Sign in with a recovery code, which gives a restricted session. From there they link a new identity or delete the account.
   - With no code and no identity left: there is a documented removal-request path (section F5).

---

## D. Wireframes

Revision 1's wireframes (sign-in, directory, profile, dashboard, settings and GitHub sync) still apply, with these changes:

- All directory and profile URLs read `/{lang}/community/…`.
- **Sign-in** gains a third option below GitHub and Nostr: "Tumia msimbo wa kurejesha / Use a recovery code". It sits under a `<details>` so it doesn't distract new users.
- **Nostr sign-in on a phone without an extension:**

```
┌──────────────── Endelea na Nostr ───────────────┐
│ Hatukuona kisaini kwenye kivinjari hiki.        │   (No signer found in this browser.)
│ ▸ Tumia programu ya kisaini (Android)           │   → NIP-46: shows a nostrconnect:// QR
│     [QR]  au  [Fungua kwenye programu]          │     and an "open in app" link
│ ▸ Bandika kiungo cha bunker://                  │   → NIP-46: paste a bunker URI
│ Hatutakuomba nsec yako kamwe.                   │   (We will never ask for your nsec.)
└─────────────────────────────────────────────────┘
```

- **Settings** gains a recovery-codes block: "Misimbo 8 kati ya 10 imebaki · Tengeneza upya" (8 of 10 codes left · Regenerate). Regenerating requires re-authentication and invalidates the old set.
- **Profile visibility control** carries an honest note: "Ukiufanya binafsi, unaacha kuonekana mara moja kwenye Jifunze. Nakala ambazo watu walishapakua kwenye vifaa vyao hatuwezi kuzifuta." (When you make it private, it stops showing on Jifunze immediately. We can't delete copies people already downloaded to their own devices.)

---

## E. Architecture

### E1. Components (D2 approved)

```
Browser ── https://jifunze.bitsacco.com (proposed, D3) ──┐
                                                          ▼
                                       nginx (existing image)
   static export: /, /_next/, /sw.js, lessons …          │  /api/*  → proxy (Cache-Control: no-store)
   /{sw,en}/community/{handle}/ → one shell per language │──────► api (Node 24 + TypeScript)
                                                                   │ GitHub sign-in, Nostr verify,
                                                                   │ sessions, profiles, sync loop
                                                                   ▼
                                                               PostgreSQL 16
```

- There is **no build-time database access** and no snapshot. Revision 1's publish-triggered rebuild is removed, so the static build stays secret-free, as it is today.
- **API:** `node:http` plus a small router (D11). Every route declares its method, auth requirement and zod schema in one table. Unknown routes return 404 and wrong methods 405. A test enumerates the table and asserts that every non-public route rejects a request without a session. Errors are generic outside and detailed only in logs, with no tokens or bodies.
- **Background sync** is an in-process loop under `pg_try_advisory_lock`. There is no queue.

### E2. Public-profile publication and privacy (correction 2)

**Revision 1 is rejected for privacy.** Static pages built from snapshots can outlive an unpublish in four ways:
- a failed or delayed rebuild leaves the old file served;
- a CDN keeps the old response;
- old container images still contain the page;
- the current service worker keeps a copy and serves it offline (investigation 2).

**The mechanism: one static shell plus live data.**

1. **One shell per language.** `out/{lang}/community/profile/index.html` is built once and contains no builder data.
   - nginx: `location ~ ^/(sw|en)/community/[a-z0-9-]+/$ { try_files /$1/community/profile/index.html =404; }`
   - The CSP stays hash-based.
2. **Data is fetched live.** The shell reads the handle from the URL and fetches `GET /api/public/builders/{handle}`.
   - The API answers from the database at request time.
   - Anything that is not `visibility='public'`, a deleted account, or an unknown handle returns **404** with the same body, so the response doesn't reveal whether a private profile exists.
   - Unlisted profiles return 200 with `X-Robots-Tag: noindex`.
3. **Every `/api/*` response** carries `Cache-Control: no-store` plus `Vary: Cookie`, and the API never sets public cache headers. If a CDN is added later, it must pass `/api/*` through; that is a written deployment requirement (section E5) and a test asserts the headers.
4. **Service worker changes:**
   - (a) Never handle `/api/*`.
   - (b) Don't cache navigations under `/{lang}/account/`. Under `/{lang}/community/`, only the data-free shell may be cached; data never is.
   - (c) **Delete a cached navigation when the network returns 404 or 410.** This fixes the stale-copy behaviour found in investigation 2, for every page.
5. **Directory:** `GET /api/public/builders` uses the same rules and is never cached.

**What we can and cannot promise:**
- **We can:** when a builder makes their profile private, or deletes their account, Jifunze stops serving it on the next request, with no rebuild and no cache to purge.
- **We cannot recall copies already downloaded** to someone's device, as with any web page. We don't promise that, and the settings copy says so.

**Trade-off.** Profile content renders in the browser:
- Search engines that run JavaScript still index it.
- Link previews show generic Jifunze metadata rather than the builder's name.
- Without JavaScript, the shell says it needs JavaScript and links to the directory.

If richer link previews are wanted later, the API can serve a per-profile `<head>` subset. That is a separate decision.

**Tests, written before profiles are implemented (Increment 3 gate):**
- publish → 200 with data;
- set private → 404 on the very next request;
- delete the account → 404;
- unknown handle → an identical 404;
- `no-store` on every `/api` response;
- the service worker's caches contain no `/api` response after browsing profiles;
- a 404 navigation evicts its cached copy;
- offline on a profile shows the needs-connection state, not stale data.

### E3. Database schema (changes from revision 1)

- **`profiles`:** unchanged, including the default `visibility 'private'`. The snapshot fields are removed.
- **`contributions` is split** so distinct events are never collapsed (correction 3):

```sql
create table authored_pull_requests (
  account_id uuid not null references accounts(id) on delete cascade,
  repo_github_id bigint not null,              -- stable; renames update repo_full_name
  repo_full_name text not null,
  repo_owner_github_id bigint not null,
  pr_number integer not null,
  pr_github_id bigint not null,                 -- search item "id"
  pr_url text not null check (pr_url like 'https://github.com/%'),
  title text not null check (length(title) <= 300),
  state text not null check (state in ('open','closed','merged')),
  opened_at timestamptz not null,
  merged_at timestamptz,                        -- from search item pull_request.merged_at
  retrieved_at timestamptz not null,
  last_seen_at timestamptz not null,
  missing_since timestamptz,
  primary key (account_id, pr_github_id)
);

create table review_submissions (               -- one row per review, never merged into a count
  account_id uuid not null references accounts(id) on delete cascade,
  review_github_id bigint not null,             -- GitHub review id
  pr_github_id bigint not null,
  repo_github_id bigint not null,
  repo_full_name text not null,
  repo_owner_github_id bigint not null,
  pr_number integer not null,
  pr_url text not null check (pr_url like 'https://github.com/%'),
  state text not null check (state in ('APPROVED','CHANGES_REQUESTED','COMMENTED','DISMISSED')),  -- PENDING is never stored
  submitted_at timestamptz not null,
  retrieved_at timestamptz not null,
  primary key (account_id, review_github_id)
);

create table recovery_codes (                   -- D9 proposal, section F5
  account_id uuid not null references accounts(id) on delete cascade,
  code_hash bytea not null,                     -- HMAC-SHA256(server pepper, code)
  created_at timestamptz not null default now(),
  used_at timestamptz,
  primary key (account_id, code_hash)
);
```

- **`sync_runs`** gains two fields:
  - `coverage jsonb`: per statistic, the date slices requested, `total_count` per slice, items retrieved and whether each slice is complete.
  - `partial boolean`.
- **Unchanged:** `accounts`, `identities` (`unique(provider, provider_uid)`), `sessions`, `auth_challenges`, `learning_progress` and `security_events`. Sessions gain `scope text check (scope in ('full','recovery'))`.

### E4. API contracts (changes from revision 1)

- `GET /api/public/snapshot` is **removed**, and so is the build token.
- `GET /api/public/builders/{handle}` is now the profile source. It returns 404 for anything not public.
- `POST /api/auth/recovery` (`{ code }`, rate-limited) creates a session with `scope='recovery'`. That session may only:
  - list identities;
  - link a new identity;
  - regenerate codes;
  - export data;
  - delete the account.

  Every other route answers 403 `recovery_scope`.
- `POST /api/me/recovery-codes` (re-auth ≤ 10 min) returns 10 new codes **once** and invalidates the old ones.
- The rest is unchanged: every non-GET request needs an exact `Origin` and the `X-Jifunze: 1` header, every response carries `Cache-Control: no-store`, and the account always comes from the session.

### E5. Hosting, deployment and operations (D3 provisional: nothing provisioned)

| Need | Minimum | Indicative monthly cost (2026; to be confirmed with a provider) |
|---|---|---|
| Web and API | One small VM or container host: 1 vCPU, 1–2 GB RAM, running the existing nginx image plus the API image | ≈ $5–12 |
| Database | Managed PostgreSQL 16, smallest tier, with automated daily backups and point-in-time recovery, or self-managed on the same VM with `pg_dump` | ≈ $0–15 managed; $0 self-managed (plus operator time) |
| Domain and TLS | `jifunze.bitsacco.com` (DNS controlled by Bitsacco); Let's Encrypt or the host's TLS | $0 |
| Total | | ≈ $5–30 |

- **Environments:**
  - **Local:** `docker compose` with nginx, the API and `postgres:16-alpine`, a test GitHub App on a personal account, and `.env.local` (git-ignored).
  - **Staging:** the same compose file on an isolated host or subdomain, with its **own** GitHub App and database. It never shares secrets with production.
- **Deploys:**
  - CI builds the static image as today, plus an API image, both tagged with the commit.
  - Database migrations are forward-only, run as a separate step before the new API starts, and must be reversible by a following migration.
  - Rollback means redeploying the previous images. Migrations stay backward-compatible for one release.
- **Secrets:**
  - The GitHub App client secret and private key, the webhook secret, the recovery-code pepper and the database URL.
  - They live in the host's secret store or environment, never in the repo, image layers or logs.
  - Rotation runbook: a new App private key (both keys valid during the switch), a new webhook secret, a new pepper (requires regenerating codes, so the pepper is versioned per row).
- **Backups:** daily logical dump plus the provider's point-in-time recovery; keep 7 daily and 4 weekly copies, encrypted; a **restore drill every quarter** into staging, recorded.
- **Recovery targets:** RPO 24 h (or minutes with point-in-time recovery) and RTO 4 h.
  - Learning pages keep working offline and from the static image even if the API is down.
  - Profiles and the directory fail closed: they return 404 or show an error, and never stale data.
- **CDN, if one is ever used:** it must bypass `/api/*` and respect `no-store`, and a deployment check verifies this.

---

## F. Security

### F1. Threat model

Revision 1's table stands, with these changes:
- the public-profile rows are replaced by section E2;
- the Nostr row is replaced by section F2;
- the account-recovery rows are added in section F5.

### F2. Nostr verification (correction 1): implemented and tested in investigation 1

`POST /api/auth/nostr/verify` accepts only when **every** rule holds. Checks run in this order, and the challenge is consumed **last**, so an attacker who has seen a challenge id can't burn it with an invalid event:

1. **Header.** `Authorization: Nostr <base64(JSON event)>`, at most 8 KB.
2. **Shape (NIP-01 formats):**
   - `id` is 64 lowercase hex characters, `pubkey` 64 and `sig` 128;
   - `created_at` and `kind` are safe integers;
   - `tags` is an array of non-empty arrays of strings;
   - `content` is a string.
3. **`kind == 27235`** (NIP-98).
4. **`content == ""`.** Our policy: login events carry nothing else.
5. **`id` equals SHA-256 of the NIP-01 canonical serialization** `[0,<pubkey>,<created_at>,<kind>,<tags>,<content>]`:
   - UTF-8, with no whitespace;
   - escape **exactly** `\n` `"` `\\` `\r` `\t` `\b` `\f`;
   - every other character verbatim.

   A dedicated serializer is used, not `JSON.stringify`, which escapes other control characters such as U+0001 differently.
6. **A BIP-340 Schnorr signature** of `id` by `pubkey`, checked with `@noble/curves` `schnorr.verify`. Exceptions count as invalid.
7. **`|now − created_at| ≤ 60 s`.**
8. **Exactly one `u` tag**, equal to the **absolute** request URL `https://<SITE_ORIGIN>/api/auth/nostr/verify`, with no query. This binds the event to this application.
9. **Exactly one `method` tag**, equal to `POST`.
10. **The body is present**, so there must be exactly one `payload` tag equal to the lowercase hex SHA-256 of the **exact raw request bytes**. When there is no body, a `payload` tag is rejected.
11. **Challenge binding.** The body is `{"challengeId","nonce"}`. It is consumed atomically:

```sql
update auth_challenges set used_at = now()
 where id = $1 and secret_hash = sha256($nonce) and binding_hash = sha256($preauth_cookie)
   and purpose = $purpose and used_at is null and expires_at > now()
returning account_id;
```

Exactly one row means success; zero means `challenge_invalid`. Challenges expire after 5 minutes.

**Evidence** (investigation 1):
- 19/19 BIP-340 vectors.
- 200/200 real relay events, by both id and signature.
- 19 negative cases each rejected with its own code.
- Under 20-way concurrency against PostgreSQL, exactly one acceptance.

These become the API's permanent unit tests, using the BIP-340 CSV, recorded relay events as fixtures, and the negative cases.

### F3. Nostr on mobile (D6)

| Method | How it works | Status | Notes |
|---|---|---|---|
| NIP-07 | A browser extension's `window.nostr.signEvent` | **Increment 2b** | Mostly desktop; some mobile browsers have extensions |
| **NIP-46** | A `nostrconnect://` QR or link (client-initiated, with a required secret) or a pasted `bunker://` URI. Messages are kind 24133, NIP-44 encrypted, over relays. The identity is the `get_public_key` result, not the remote signer's key | **Primary Android path**; Increment 2c, subject to the interop and security assessment below | The sign-in page needs `connect-src` for the chosen relays (`wss://…`), **on that page only**. Client code: `nostr-tools` (nip46 and nip44), loaded **only after** the user picks this option, on the sign-in route. Needs D11 approval |
| NIP-55 | A `nostrsigner:` URL; the result returns through `callbackUrl` or the clipboard; one prompt per request | **Evaluate only** | The spec recommends NIP-46 for web. If used, the callback must put the event in the URL **fragment** (`#…`) so it never reaches server logs or referrers |

**Interop and security assessment before 2c ships:**
- **Signers:** at least two independent NIP-46 signers, one Android app and one web or remote bunker.
- **Devices:** a low-end Android phone on Chrome. This needs the maintainer or a volunteer with a device; it can't be emulated honestly.
- **Pass criteria:**
  - login completes in under 60 s;
  - the identity is the `get_public_key` result;
  - a wrong secret is rejected;
  - relays see only encrypted traffic;
  - closing the signer cancels the attempt cleanly.

No signer app is named as supported until it passes.

**Never:** asking for an `nsec`, an input field that would accept one, or storing the client's ephemeral NIP-46 key beyond the attempt.

### F4. Account linking

Unchanged from revision 1:
- Linking needs a fresh proof of the new identity, through a challenge with `purpose='link'` bound to the signed-in account and the pre-auth cookie.
- `unique(provider, provider_uid)`.
- An identity already linked to another account returns 409 `identity_in_use`, with no merge.
- Nothing is ever merged on usernames, emails, bios or metadata.

### F5. Account recovery (D9): proposal for approval

**Goal:** someone who loses one way in can get back in, with no email or password.

1. **Recovery codes.**
   - Ten single-use codes, each 16 base32 characters (80 bits), shown in groups of four, for example `K7QM-2XPA-9DTR-4HWE`.
   - They're shown **once**, at account creation, with a required "I've saved them" step. They can be regenerated in settings after re-authentication.
   - Stored as `HMAC-SHA256(pepper_vN, normalised code)`, so a database leak alone can't test guesses offline. 80 bits is also far beyond guessing online.
   - Using one: `POST /api/auth/recovery` → a **restricted session** (`scope='recovery'`, 15 minutes) → link a new identity or delete the account. The code is consumed atomically, like a challenge.
   - **Rate limits:** 5 attempts per 15 minutes per IP, plus 20 per hour globally per account handle.
   - It's logged as a security event and shown on the dashboard: "Msimbo wa kurejesha ulitumika {date}" (A recovery code was used on {date}).
2. **A second identity.** Linking both GitHub and Nostr is recommended at setup and in settings. Either one can recover the account.
3. **Rules that stay:**
   - The last identity can't be removed.
   - Regenerating codes and deleting the account require re-authentication within 10 minutes. A recovery session counts as re-authenticated for deletion only.

**Limitations and security implications:**
- A stolen code set is equivalent to a stolen identity. The mitigations are single use, rate limits, the dashboard notice and immediate regeneration.
- With **no email**, there is no channel to warn the owner when a code is used elsewhere. They see it only at their next sign-in.
- Someone who loses every identity **and** every code can't get their account back.

**Obligations when access is truly lost:**
- **Unpublish on request.** A person can ask, through a documented maintainer contact, to have a profile taken down. Maintainers act on reasonable evidence: for GitHub, the request comes from that GitHub account's own public channel, such as an issue opened by that login. The action is an audited admin CLI command that sets `visibility='private'` and logs `admin_unpublish`.
- **Deletion on request** follows the same evidence rule.
- **Inactivity safeguard:** public profiles with no sign-in for 18 months become **unlisted**: still reachable, but out of the directory. The builder sees this at their next sign-in. Nothing is deleted automatically.

### F6. Retention (D13): tested

- **Daily purge:**
  - expired sessions and challenges;
  - security events older than 90 days;
  - `missing_since` items older than 30 days.
- **Account deletion:**
  - cascades every row;
  - writes one security event with `account_id = null` and no personal data;
  - is verified by a test that inspects every table.
- **Logs:**
  - no request bodies, tokens, cookies or full IP addresses (a /24 prefix at most);
  - application log retention is 14 days.

---

## G. GitHub integration

### G1. Statistic definitions (correction 3)

Every public number is the **count of stored evidence records** behind it, and each record links to GitHub.

| Statistic | Definition | Evidence row | Headline? |
|---|---|---|---|
| **PRs opened** | Distinct pull requests the builder authored, in any state, in public repositories | `authored_pull_requests` (one row per PR) | yes |
| **PRs merged** | Distinct authored PRs with `merged_at` set | the same rows, where `merged_at` is not null | yes |
| **PRs reviewed** | Distinct PRs, **not authored by the builder**, with at least one review submission by the builder | distinct `pr_github_id` in `review_submissions` | yes |
| **Review submissions** | Individual reviews submitted (APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED; never PENDING) | one `review_submissions` row each | **no**. Shown only in a PR's detail with the states listed. Investigation 3 found 54 submissions by 8 reviewers on one PR, and 38 of 48 COMMENTED had no body; this reflects commenting style, not effort |
| **Approvals given** | Review submissions with state APPROVED | rows where `state='APPROVED'` | optional detail |
| **Outside own repositories** | The subset of each statistic where `repo_owner_github_id ≠` the builder's GitHub id | a flag computed from stored ids | yes, as a filter. Organisation-owned repos count as "outside", which the UI says |

- **No commit counts.** A commit appearing in a repo isn't proof of authorship by this account.
- **No contribution-calendar totals.** `contributionsCollection` windows remain unverified, and its counts can include restricted (private) totals.

### G2. Completeness

GitHub search returns at most 1,000 items per query but reports an exact `total_count`. For each statistic, import:
1. queries `total_count`;
2. **bisects date ranges** (`created:A..B`) until every slice is under 1,000;
3. retrieves every slice and records the coverage in `sync_runs.coverage`.

Investigation 3: a reviewer with 4,549 reviewed PRs split into three slices (1,185, 1,654 and 1,710) that summed exactly, so finer slices are needed and work.

- **Complete:** "86 PRs merged".
- **Incomplete** (a slice timed out with `incomplete_results`, or the run hit rate limits): "Angalau 86 / At least 86 PRs merged (synced partially on {date})". **No count is ever shown as complete when it isn't.**
- **Costs for review submissions:** they need one `GET …/pulls/{n}/reviews` per reviewed PR. For prolific reviewers the first import runs over several scheduled rounds, and the profile shows "partial" until it finishes.

### G3. Fields and identity

- **Search items** give `id` (the PR), `number`, `html_url`, `title`, `state`, `created_at`, `pull_request.merged_at`, `user.id` and `repository_url`.
- **Repository ids are not in search items.** One cached `GET /repos/{owner}/{repo}` per repository gives `id` and `owner.id`.
- **Renames** keep `repo_github_id`; deleted items get `missing_since` and are hidden after two misses.
- **The builder is identified by GitHub numeric id**, never by login.

### G4. Credential for public data (D5): unverified, with a fallback for review

- **Plan:** an installation token from the Bitsacco GitHub App (a test App in development), reading **public** data only.
- **Status:** it is **not verified** whether an installation token sees public PRs and reviews in repositories outside its installation. The ready-to-run check is `spikes/…/github-app/installation-search.mjs`; it needs a test App with no permissions on a personal account.
- **If the check fails, the options go back to the maintainer. None is adopted automatically:**
  - **(a) Recommended fallback.** Import during sign-in, using the 8-hour user token from the callback, then discard it. "Refresh" becomes "sign in with GitHub again". No token is stored and there is no scheduled sync for that builder; freshness is shown honestly.
  - **(b)** A dedicated machine account's read-only, public-only fine-grained token, stored as an operational secret. Simpler sync, but it adds a long-lived secret and one shared rate limit.
  - **(c)** Unauthenticated requests: 10 searches per minute and 60 core requests per hour. Too low for anything except tiny scale.

### G5. Ecosystem registry (D10)

- `content/ecosystem.json` is maintained through PR review. Each entry: `{ match: "owner/*" | "owner/repo", technologies: [...], note }`.
- **It's broad from the start:**
  - Bitcoin Core and libraries (bitcoin/*, bitcoindevkit/*, rust-bitcoin/*, libsecp256k1).
  - Lightning implementations and tools (lightningnetwork/*, ElementsProject/lightning, ACINQ/*, lightningdevkit/*, LN tooling).
  - Ecash: cashubtc/*, fedimint/*.
  - nostr-protocol/* and major Nostr clients and relays.
  - Wallets.
  - bitsacco/*.
- **Contributions to repos outside the registry still count** and appear under "Other open source". The registry only adds technology tags for filtering.
- No score.

### G6. Sync

- **Triggers:**
  - The initial import when a profile is created.
  - User refresh, at most once an hour.
  - A daily scheduled refresh for public profiles, only if G4 confirms an installation token.
- **Mechanics:** idempotent upserts on the primary keys; backoff on 403 or 429 using `Retry-After` and `x-ratelimit-reset` (1, 4 and 16 minutes, capped).
- **Revocation:** the `github_app_authorization` webhook (verified by HMAC) stops sync and hides imported records until the builder reconnects.

---

## H. Implementation plan

### H1. Increments

Each increment is its own PR from an up-to-date `main` (`254e757` or later). Every increment must:
- keep check, build, the UX budget, the full Playwright suite and the lab job green;
- **measure** the JS impact on learning pages and report it; no budget changes without approval;
- keep bilingual parity;
- use signed commits with no trailers.

| # | Increment | Scope | Gate to start | Acceptance (tests) |
|---|---|---|---|---|
| 2a | API foundation and GitHub sign-in | `api/` (router table, zod, errors), migrations, sessions (full and recovery scopes), GitHub start and callback with PKCE, logout, `/me`, nginx `/api` proxy, **service-worker changes** (no `/api`, no account pages, evict on 404 or 410), header "Akaunti" link, sign-in and welcome pages, recovery codes | **D9 approved**; test GitHub App created (maintainer); local compose stack | State reuse, PKCE mismatch, expired state and an open-redirect `return` are rejected; cookie flags; every non-public route rejects anonymous requests (router-table test); service-worker tests; JS impact measured (expected 0.00 KB on learning pages); recovery codes are single-use and rate-limited; axe in both languages |
| 2b | Nostr NIP-07 | Challenge and verify (section F2) with the spike's vectors as permanent tests | 2a merged | All F2 positive and negative vectors; concurrency test; "no signer" state in both languages |
| 2c | Nostr NIP-46 | QR and `bunker://` on the sign-in page; route-local `nostr-tools`; per-page `connect-src` for relays | 2b merged; **`nostr-tools` approved (D11)**; interop assessment passed (F3) | Interop matrix recorded; identity is `get_public_key`; wrong secret rejected; no key persisted |
| 2d | Linking and settings | Link and unlink, sessions list, language preference, export, delete, retention jobs | 2a merged | 409 `identity_in_use`; last identity locked; cross-account IDOR tests; deletion inspects every table; retention purge tests |
| 3 | Profiles and community | Profile editor, visibility, bilingual bios with original-language marker, skills vocabulary, **live profile shell** at `/{lang}/community/{handle}/`, directory, **bilingual catalogue search** | 2d merged; **E2 tests written first** | All E2 privacy tests; "pochi" on `/en/learn/` and "seed phrase" on `/sw/learn/` find the wallets lesson; 360 px; no-JS shell message; axe |
| 4 | GitHub contributions | Search import with date bisection, evidence tables, coverage and partial labels, review submissions, ecosystem registry, webhook | **G4 investigation run**, with its outcome approved | Statistic semantics from G1, with fixtures for multiple reviews per PR, a slice over 1,000, `incomplete_results`, renames, deletions and 429; every count equals its evidence rows |
| 5 | Dashboard and learning sync | Dashboard, explicit progress merge, projects, Builder Journey | 3 and 4 merged | Deterministic merge; local data never lost; offline and import/export regressions pass |
| 6 | Hardening | Security review against section F, auth-failure and offline suites, low-end Android pass, operations runbook (E5) | 5 merged | Evidence report; no open Critical or Important findings |

### H2. Bilingual work (correction 5, D12)

- **Language preference:**
  - It goes into OAuth `state` and the Nostr challenge.
  - Callbacks return to the same language and page.
  - It is stored as `accounts.preferred_lang`.
  - For the bare `/`, nginx reads an optional `jf_lang` cookie (`map $cookie_jf_lang`) and redirects. **No client script, and never by location.**
- **Copy:** every Phase 3 string, including auth, dashboard, profiles, errors, empty states and privacy controls, lives in route-local copy modules with parity tests. Nothing goes in the shared client dictionary.
- **Builder bios** are written independently per language. When only one exists, it's labelled "Imeandikwa kwa Kiingereza / Written in Kiswahili". There is no machine translation.
- **Terminology pending editorial review** (tracked in `content/terminology-review.json` from Increment 2a; marked *pending*, never shown as reviewed):
  - pull request, merge or merged, code review, review submission, repository, fork, contributor, maintainer;
  - sign in, sign out, session, recovery code;
  - signer, remote signer, public key (npub), private key (nsec), relay;
  - verified, synced, partial.

  These ship only after review by Kenyan and Tanzanian Kiswahili reviewers (D12, not yet appointed).

---

## I. Open items before Increment 2

| # | Item | Owner | Blocks |
|---|---|---|---|
| 1 | ~~Review and merge PR #5~~ **Done** (`254e757`) | Maintainer | n/a |
| 2 | Approve the recovery design (F5) | Maintainer | 2a |
| 3 | Create a **test GitHub App** on a personal account (no permissions), and share its id, client id and secret, installation id and private key through a secure channel, not in chat | Maintainer | 2a (sign-in development) and G4 (installation-token check) |
| 4 | Run the G4 check (`installation-search.mjs`) and decide on (a), (b) or (c) if it fails | Claude runs it; maintainer decides | 4 |
| 5 | Approve `nostr-tools` for the NIP-46 client only (D11) | Maintainer | 2c |
| 6 | Arrange an Android device and two NIP-46 signers for interop testing | Maintainer or volunteer | 2c release |
| 7 | Confirm DNS control for `jifunze.bitsacco.com` and a staging host | Maintainer | Deployment (not development) |
| 8 | Appoint Kiswahili reviewers (Kenya and Tanzania) | Maintainer | Release of new terminology |

### Risks

- **Profile metadata.** With live data, link previews are generic. A per-profile head subset can be added later.
- **API downtime** takes the community pages offline, by design: they fail closed and never show stale data.
- **G4 may fail.** Fallback (a) keeps privacy, but there would be no scheduled sync for those builders.
- **Mobile Nostr** depends on signer interoperability, which must be proven on real devices.
- **New operating surface:** secrets, backups and migrations. Section E5 lists the runbook items, and Increment 6 delivers it.
- **The header has about 1.3 KB of JS headroom on lessons.** Every header change is measured.
