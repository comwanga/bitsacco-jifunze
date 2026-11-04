# Phase 3: GitHub, Nostr and the builder ecosystem: design (revision 3.2)

**Status.** Revision 2's architecture is **approved in principle** (maintainer review, 2026-11-04). This revision 3:
- applies that review's corrections: the recovery-flow conditions (F5), the visibility semantics and HTML indexing (E2), and documentation consistency;
- pins the NIP-46 client dependency (F3).

The investigation evidence is in [`spikes/2026-11-04-phase-3`](../spikes/2026-11-04-phase-3/README.md).

**Revision 3.1** (2026-11-04) records the final approvals of F5, E2 and the NIP-46 connection policy, with their conditions:
- unlisted-link leak protection and tests that privacy changes take effect immediately (E2);
- NIP-46 relay validation and route-scoped CSP tests (F3);
- concurrency tests for identity replacement (F5);
- a release gate (H3).

**Revision 3.2** (2026-11-04) corrects unlisted-link usability: the fragment is **kept**, so refresh, copying and language switching work; unlisted links are documented as bearer credentials; the tests are updated (E2).

**Implementation starts** when this PR is merged and the test GitHub App is available (section I), with Increment 2a first.

Journey: **Jifunze → Jaribu → Jenga → Changia → Kua** (Learn → Practise → Build → Contribute → Grow).

---

## 0. Decision record

| ID | Decision | Maintainer outcome | How this revision applies it |
|---|---|---|---|
| D1 | Homepage polish onto `main` | **Approved** | **Done.** PR #5 merged as `254e757`; `main` now equals the reviewed polish tree, and CI is green. Phase 3 starts from this `main` |
| D2 | Architecture | **Approved** | Static learning site, same-origin Node API, PostgreSQL and the nginx `/api` proxy. **E2 approved**: nginx checks visibility before serving public profile HTML, profile data is live, and there is no extra caching layer. Revision 3.1 adds the unlisted-link and immediate-effect safeguards |
| D2-nav | Navigation | **Approved** | Paths · Labs · Builders · Resources, plus language and account (section B) |
| D3 | Hosting and domain | **Provisional** | `jifunze.bitsacco.com` is the proposed domain until DNS and hosting are confirmed. Requirements, costs, deploys, secrets, backups and recovery are in section E5. Nothing is provisioned |
| D4 | GitHub App ownership | **Conditionally approved**; test App **approved** | Development uses an isolated test App on a personal account, with no permissions; the maintainer provides its credentials separately. Secrets never go in chat, the repo, screenshots or logs. Long term: the Bitsacco org, after admin authorisation |
| D5 | No user-token storage | **Approved** | Tokens are used once for `GET /user` and discarded. Installation-token coverage is **unverified** (investigation 4 needs the test App). If it fails, this goes back for review; encrypted storage is **not** adopted automatically (section G4) |
| D6 | Nostr | **Approved with mobile requirements** | NIP-07 first; NIP-46 is the primary Android path, subject to interop and security assessment; NIP-55 is evaluated (section F3) |
| D7 | Directory membership | **Approved** | Only signed-up users who publish appear |
| D8 | Images | **Approved** | GitHub avatars only, from one allowlisted host; no Nostr images; generated fallback avatar |
| D9 | Recovery | **Approved** (F5, revision 3) | Includes concurrency tests for replacement (F5). Administrative removal needs **legal review before general release**, and deletion keeps strong evidence and two-maintainer approval |
| D10 | Ecosystem registry | **Approved** | A curated, broad, reviewable registry with no score (section G5) |
| D11 | API dependencies | **Provisionally approved**; `nostr-tools` and the sign-in page's `connect-src 'self' wss:` **approved with conditions** | API: `postgres`, `@noble/curves`, `@noble/hashes`, `zod`, and a minimal router with tests for its boundaries. Client: `nostr-tools` **2.25.2**, NIP-46 only, loaded after explicit activation on the Nostr sign-in page only, with the relay validation and resource rules in F3 |
| D12 | Translation review | **Approved in principle** | New terminology is tracked as **pending review** and not released as reviewed (section H2). Increment 2a's account terms were approved on 2026-11-04 by the project maintainer, a native Kiswahili speaker; no other reviewers are named yet |
| D13 | Retention | **Approved** | Security events kept 90 days; sessions and challenges purged daily; covered by tests (section F6) |

---

## A. Repository assessment (verified 2026-11-04)

- **`main` = `254e757`** (verified 2026-11-04; CI green): v1, Phase 1, Phase 2, the review fixes, the CI prefetch fix and the homepage polish.
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
| `/{lang}/community/{handle}/` | **static shell plus live data**, served only after nginx confirms the profile is public | Public profiles |
| `/{lang}/community/unlisted/#k={token}` | a fixed, data-free shell; the **token is in the URL fragment**, so it never reaches any server; HTML sent with `X-Robots-Tag: noindex, nofollow` | Unlisted profiles (E2, revision 3.1) |

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
   - Sign in with a recovery code, which gives a restricted 15-minute session. From there they can **replace** the lost identity (same provider or the other one), regenerate codes, export, or delete the account.
   - With no code and no identity left: emergency unpublication on reasonable evidence; deletion only on strong evidence (section F5).

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
- **Visibility control** has three options:
  - Umma / Public: in the directory and at its link.
  - Bila kuorodheshwa / Unlisted: only at a private link, which can be reset. It is labelled as working like a key: anyone holding the link can view (E2).
  - Binafsi / Private: nowhere.

  It carries an honest note: "Ukiufanya binafsi, unaacha kuonekana mara moja kwenye Jifunze. Nakala ambazo watu walishapakua kwenye vifaa vyao hatuwezi kuzifuta." (When you make it private, it stops showing on Jifunze immediately. We can't delete copies people already downloaded to their own devices.)

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

### E2. Profile visibility, indexing and privacy

**Visibility semantics** (maintainer-defined):

| Visibility | In directory | Reachable at | Indexing |
|---|---|---|---|
| **Public** | yes | `/{lang}/community/{handle}/` | indexable |
| **Unlisted** | no | **only** `/{lang}/community/unlisted/#k={token}` (32-byte random token, resettable); the handle URL returns 404 | `X-Robots-Tag: noindex, nofollow` on the **HTML** response; the fragment is never sent to servers |
| **Private** | no | nowhere; every public URL returns 404 | n/a |

Revision 2 is corrected here on two points:
- It put `X-Robots-Tag` only on the JSON API. That doesn't control indexing of the profile's **HTML URL**.
- It let the static shell return 200 for any handle.

**Mechanism.** nginx asks the API before serving profile HTML. The shipped image is nginx 1.30.6, built with `--with-http_auth_request_module` (verified).

```nginx
location = /_visibility {                      # internal subrequest only
  internal;
  proxy_pass http://api:3001/api/internal/visibility;
  proxy_pass_request_body off;
  proxy_set_header Content-Length "";
  proxy_set_header X-Original-URI $request_uri;  # the profile path being requested
}
location ~ ^/(sw|en)/community/[a-z0-9-]+/$ {          # public profiles
  auth_request /_visibility;                  # API: 204 if visibility='public', else 403
  error_page 403 =404 /404.html;               # not visible -> a real 404
  error_page 500 502 503 504 =503 /offline/index.html;  # API down -> fail closed with 503
  add_header Cache-Control "no-store" always;
  include /etc/nginx/snippets/security-headers.conf;
  try_files /$1/community/profile/index.html =404;
}
# Unlisted shell: no data, token only in #fragment. Exact-match locations take priority over the
# regex above, and "unlisted" is a reserved handle, so it never reaches the public-profile check.
location = /sw/community/unlisted/ { include /etc/nginx/snippets/unlisted-shell.conf; }
location = /en/community/unlisted/ { include /etc/nginx/snippets/unlisted-shell.conf; }
# unlisted-shell.conf:
#   add_header X-Robots-Tag "noindex, nofollow" always;
#   add_header Cache-Control "no-store" always;
#   include /etc/nginx/snippets/security-headers.conf;   # includes Referrer-Policy: no-referrer
#   try_files $uri/index.html =404;
```

- **Real status codes.** Private, deleted or unknown profiles get a **real HTTP 404**, not a soft 200 shell, so crawlers drop them and nothing about them is served.
- **Fails closed.** `auth_request` only accepts 2xx (allow) or 401/403 (deny), and turns any other answer into an error. So the API answers **403** for not-visible, which nginx maps to 404. If the API is down, nginx returns **503**: the shell is not served, and crawlers see "temporarily unavailable" rather than a 404 that would drop public profiles.
- **Data is never in the HTML.** The shell is identical for every profile; the data comes from the API under the same visibility rules:
  - public profiles: `GET /api/public/builders/{handle}`;
  - unlisted profiles: `POST /api/public/builders/unlisted` with `{ "token": … }` in the body.

**Unlisted-link leak protection** (revision 3.1). Verified current state: the site sends `Referrer-Policy: no-referrer` on every response, and has no analytics or third-party scripts. nginx's default access log does record full request URIs, so a token in the path would have been logged. Therefore:

1. **The token lives in the URL fragment** (`#k=…`). Browsers never send fragments to servers, so it can't appear in nginx or API access logs, proxies or CDNs, and fragments are always removed from referrers.
   - The shell reads the token from `location.hash` and **leaves the fragment in place** (revision 3.2). Revision 3.1's `history.replaceState` would have broken refresh, copying and language switching. This means:
     - **Refresh** reloads the same URL, fragment included, so access continues.
     - **Copy link:** the address bar holds the complete sharing link, and a "Nakili kiungo / Copy link" button copies `location.href` exactly.
     - **Language switch:** the shared `LanguageSwitch` builds its link from the path alone, which would drop the fragment. On this page only, the route's own script sets the language link's `href` to the other-language shell plus the current `location.hash`, on load and on `hashchange`. The shared component and every other page are unchanged, so no shared JS is added.
   - It sends the token in a POST body, which the API never logs.
   - Messaging apps that build link previews fetch the URL without the fragment, so they see only a generic page.
2. **`Referrer-Policy: no-referrer`** stays on every response, including the community shells and `/api/*`. A test asserts the header on those routes.
3. **No analytics or third-party scripts** on community or account pages. The CSP already forbids them (`script-src 'self'` plus hashes), and a test asserts that no external script source appears in those pages' CSP.
4. **Logs:**
   - The API logs method, route **template** (for example `/api/public/builders/:handle`), status and latency only: never bodies, tokens, cookies or full IP addresses.
   - nginx logs for `/api/` use a format without `$http_referer`.
   - Retention is 14 days (F6).
5. **The unlisted endpoint** compares sha256(token) through an indexed lookup and returns an identical 404 for invalid tokens. It is rate-limited per IP (60 per 10 minutes), though a 256-bit token can't be guessed.
6. **No external request carries the token.**
   - The page loads no third-party resources: the CSP allows only `'self'`, and GitHub avatars by URL, which contain no token.
   - Outbound links (for example to GitHub PRs) send no referrer.
   - The fragment stays only in the browser.

**Unlisted links are bearer credentials** (revision 3.2). Anyone who has the link can view the profile while it stays unlisted and the token is unchanged. The link isn't tied to a person or device. Because the fragment is kept, it can also remain in:
- the viewer's browser history, synced history and bookmarks;
- chat apps and email where it was shared;
- the address bar, which browser extensions with "read your browsing history" permission can see.

**Revoking the link:**
- **Reset link** issues a new token, and the old link stops working on its next request.
- Switching to **private** stops every link.
- Neither can erase copies of the link held elsewhere, and neither needs to: an old link no longer grants access.

**What the builder is told.** The settings screen says this in both languages: "Yeyote mwenye kiungo hiki anaweza kuona wasifu wako. Kitunze kama ufunguo; ukikipoteza, tengeneza kipya." (Anyone with this link can see your profile. Keep it like a key; if it leaks, make a new one.)

This is the simplest correct model. There is no persistent storage and no extra authentication: just the link, revocable at any time.
- **Caching:**
  - **Every** `/api/*` response gets `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
  - Profile HTML gets `Cache-Control: no-store`.
  - If a CDN is ever added, it must pass `/api/*` and `/{lang}/community/*` through uncached. That is a deployment requirement with a header check.
- **Service worker:**
  - (a) Never handle `/api/*`.
  - (b) Navigations under `/{lang}/account/` and `/{lang}/community/` are **network-only**: never cached, with the offline page shown when there's no connection.
  - (c) Delete a cached navigation when the network returns 404 or 410. This fixes the stale-copy behaviour from investigation 2 for every page.
- **Directory:** `GET /api/public/builders` lists only `visibility='public'`. The directory page (`/{lang}/community/`) is indexable, but its data is never cached.
- **Sitemap:** the static sitemap lists the directory page only. Profile URLs are discoverable through the directory, and are not listed until a dynamic sitemap is separately approved.

**What we can and cannot promise.**
- **We can:** a change to private or unlisted, a link-token reset, or an account deletion takes effect on the **next request**. Jifunze keeps no server or cache copy.
- **We cannot recall copies already downloaded to someone's device.** The settings copy says so.

**Trade-off.** Content renders in the browser:
- Link previews show generic Jifunze metadata.
- Without JavaScript, the shell says it needs JavaScript.

**Immediate effect, including reuse of an old link** (revision 3.1). Every view fetches live data with `no-store`. The shell also listens for `pageshow` with `event.persisted`: when the browser restores a page from its back/forward cache, the shell **re-fetches before showing anything**, so a cached page in memory can't show data that has since been withdrawn.

**Tests, written before profiles are implemented (Increment 3 gate):**
- **Immediate effect, for HTML and API, in one browser session:**
  - open a public profile, set it private in another session, then reload the **same URL** → HTML 404 and API 404;
  - navigate away and press **Back** → the restored page re-fetches and shows "not available";
  - open an unlisted link, reset its token, then reuse the **old link** → the API returns 404 and the page shows "not available";
  - switch unlisted → private → the token link fails;
  - switch private → public → the handle URL works at once;
  - delete the account → every link fails.
- **Unlisted-link usability** (revision 3.2):
  - opening a shared `#k=` link shows the profile;
  - **refresh** shows it again;
  - **switching** sw→en and en→sw keeps the fragment and shows the profile in the other language;
  - the language link on every **other** page is unchanged;
  - **Copy link** puts the exact full URL, fragment included, on the clipboard;
  - **resetting** the token makes an open tab show "not available" on refresh, while the new link works;
  - **switching to private** makes the existing link fail on refresh.
- **Leak protection:**
  - across all of the flows above, nginx and API access logs contain no unlisted token (a log scan in CI);
  - every request the browser makes during those flows, captured in Playwright, has the token only in the body of `POST /api/public/builders/unlisted`: never in a URL, in a `Referer`, or on another host;
  - `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow` are present on the unlisted shell.
- **Status codes:**
  - public → HTML 200, and the API returns data;
  - set private → HTML **404** on the next request;
  - set unlisted → the handle URL 404s, and the unlisted shell returns 200 with `X-Robots-Tag: noindex, nofollow` and no data in its HTML;
  - reset the token → the old token's API call 404s;
  - delete the account → 404;
  - unknown handle → an identical 404.
- **The API down:** profile URLs return 503 and never serve the shell.
- **Headers:** `no-store` on every profile HTML and `/api` response.
- **Service worker:** no `/api` or community response in any cache after browsing; a 404 evicts a cached copy; offline on a profile shows the offline page.

### E3. Database schema (changes from revision 1)

- **`profiles`:** unchanged, including the default `visibility 'private'`. The snapshot fields are removed.
  - Reserved handles (revision 3.1) are refused by a check constraint and by the API: `unlisted`, `profile`, `new`, `edit`, `settings`, `api` and `admin`. This stops a handle from colliding with a fixed community route.
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

create table recovery_codes (                   -- section F5
  code_hash bytea primary key,                  -- HMAC-SHA256(pepper_vN, normalised code); globally unique, so the code alone finds the account
  pepper_version smallint not null,
  account_id uuid not null references accounts(id) on delete cascade,
  set_id uuid not null,                         -- regenerating replaces the whole set
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table profiles
  add column unlisted_token_hash bytea unique;  -- sha256 of the 32-byte link token; set while visibility='unlisted'

create table admin_actions (                    -- section F5: every manual removal action
  id bigserial primary key,
  account_id uuid,                              -- null after deletion
  action text not null check (action in ('unpublish','restore','delete')),
  evidence text not null,                       -- what was verified (no secrets, no copies of IDs)
  approved_by text[] not null,                  -- maintainer handles; deletion requires two
  at timestamptz not null default now()
);
```

- **`sync_runs`** gains two fields:
  - `coverage jsonb`: per statistic, the date slices requested, `total_count` per slice, items retrieved and whether each slice is complete.
  - `partial boolean`.
- **Unchanged:** `accounts`, `identities` (`unique(provider, provider_uid)`), `sessions`, `auth_challenges`, `learning_progress` and `security_events`.
  - Sessions gain `scope text check (scope in ('full','recovery'))`.
  - `auth_challenges` gains `session_token_hash bytea` (Increment 2a review, correction B). A `reauth` or `replace` challenge is bound to the exact session that started it, and its callback must present that same valid session.
  - Re-authentication must come from the identity already linked to the account (correction A).

### E4. API contracts (changes from revision 1)

- `GET /api/public/snapshot` is **removed**, and so is the build token.
- `GET /api/public/builders/{handle}` is now the profile source. It returns 404 for anything not public.
- `POST /api/auth/recovery`. Input is `{ code }` **only**, with no handle or account id, so the endpoint can't be used to test whether an account exists (F5).
  - Success creates a session with `scope='recovery'`.
  - Any failure returns the same `401 recovery_invalid` with no detail.
  - The recovery session may only:
    - list identities;
    - **replace** an identity (`POST /api/me/identities/{provider}/replace/start`, then the provider flow with `purpose='replace'`);
    - regenerate codes;
    - export data;
    - delete the account.

    Every other route answers 403 `recovery_scope`.
- `GET /api/internal/visibility` is **internal only**: an nginx `auth_request` subrequest that reads `X-Original-URI`. The public `location /api/` blocks `/api/internal/` with a 404. It returns **204** when visible and **403** otherwise (`auth_request` treats any other status as an error).
- `POST /api/public/builders/unlisted` takes `{ token }` in the body. It returns the profile only for an unlisted profile with a matching token, and an identical 404 otherwise. Rate-limited.
- `POST /api/me/profile/unlisted-link` resets the unlisted token and returns the new `#k=` link once.
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

**The `nostr-tools` dependency** (approved with conditions):
- **Version:** pinned to **2.25.2** (released 2026-09-04, Unlicense).
  - Its dependencies are `@noble/curves`, `@noble/hashes` and `@noble/ciphers` (audited), `@scure/base`, `@scure/bip32` and `@scure/bip39`, and `nostr-wasm`.
  - The newest release, 2.25.5, came out on 2026-11-02, too recent to pin.
  - Before 2c starts, the pinned version gets an advisory check (`npm audit` plus the GitHub advisory database) and a review of the `nip46` and `nip44` modules' changelog since the previous pin.
- **Isolation:**
  - It's imported **only** as `nostr-tools/nip46` (with `nip44`), through a dynamic `import()` that runs after the learner chooses "Use a signer app". It's never in the shared or sign-in initial bundle.
  - The sign-in page's initial JS is measured with and without that path.
- **Keys:**
  - The NIP-46 client keypair is created in memory for one attempt and dropped on success, cancel, timeout (120 s) or navigation. It's never written to storage.
  - The identity is the pubkey from the remote signer's **`get_public_key`** response, and the final login event is still verified on the server under F2.
- **CSP:**
  - NIP-46 needs WebSocket connections to relays. Client-initiated `nostrconnect://` uses a short curated relay list.
  - A pasted `bunker://` URI names the signer's relays, so the **sign-in page alone** gets `connect-src 'self' wss:`. Every other page keeps `connect-src 'self'`.
  - The session cookie is HttpOnly and the page holds no private data, so the wider policy exposes nothing new. This is listed for approval in section I.

**Conditions on the approved connection policy** (revision 3.1):
- **Activation and scope.**
  - The NIP-46 client loads only after the learner explicitly chooses "Use a signer app".
  - `connect-src 'self' wss:` is emitted **only** in the CSP of `/{lang}/account/signin/` (a `nostrSignin` flag in `scripts/postbuild.ts`, like the existing `lab` flag).
- **Relay URL validation** runs before any connection:
  - at most **5** relays, each at most **256** characters;
  - parsed with `URL`; protocol must be exactly `wss:`;
  - no `username` or `password`;
  - the host must be a DNS name or a public IP literal. These are rejected:
    - `localhost` and `*.localhost`, `*.local`, `*.internal`;
    - IPv4 in 0.0.0.0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16 and 224/4 and above;
    - IPv6 `::`, `::1`, fc00::/7, fe80::/10, IPv4-mapped private ranges and multicast;
  - no whitespace or control characters; ports allowed.
  - The same validation applies to relays from `bunker://` URIs and from `switch_relays` responses.
- **Known limitation.** A browser page can't see where a DNS name resolves, so validation can't stop a public name that points at a private address. The protections there are:
  - browsers' own private-network restrictions;
  - the fact that the page sends only NIP-44-encrypted messages carrying no secrets.

  This is documented, not claimed as solved.
- **Resources.** Sockets close and keys and request state are dropped on success, cancel, error, 120 s timeout or navigation (`pagehide`). Nothing is written to `localStorage`, `sessionStorage`, IndexedDB or cookies.
- **Identity.** It comes from the remote signer's `get_public_key` response. The final login event is still verified on the server under F2, so a lying client gains nothing.
- **Tests:**
  - **CSP scope:** a build test enumerates every exported HTML file and asserts that `wss:` appears **only** in the sign-in pages' CSP, and that every other page keeps its previous `connect-src`;
  - **relay validation:** one fixture per rejected class, plus valid cases;
  - **resources:** in-memory state and sockets are gone after cancel or timeout (Playwright, using a fake relay);
  - **activation:** the initial load of the sign-in page doesn't fetch the NIP-46 module;
  - **loading:** no third-party script is ever loaded.
- **Release gate.** NIP-46 ships only after the Android-phone and two-independent-signer interop checks. These checks don't block 2a, 2b or 2d.

**Never:** asking for an `nsec`, an input field that would accept one, or keeping an ephemeral key beyond its attempt.

### F4. Account linking

Unchanged from revision 1:
- Linking needs a fresh proof of the new identity, through a challenge with `purpose='link'` bound to the signed-in account and the pre-auth cookie.
- `unique(provider, provider_uid)`.
- An identity already linked to another account returns 409 `identity_in_use`, with no merge.
- Nothing is ever merged on usernames, emails, bios or metadata.

### F5. Account recovery (D9): revised for the four conditions

**Approved foundation:**
- ten single-use codes;
- HMAC storage;
- atomic consumption;
- short restricted recovery sessions;
- encouragement to link both providers;
- a documented removal procedure.

**Codes**
- Ten codes, each 16 base32 characters (80 bits), shown in groups of four, for example `K7QM-2XPA-9DTR-4HWE`.
- They're shown **once**, at account creation, with a required "I've saved them" step. They can be regenerated after re-authentication, which replaces the whole set.
- Stored as `HMAC-SHA256(pepper_vN, normalised code)`, which is **globally unique** (`code_hash` primary key). A database leak alone can't test guesses.

**Using a code: input contract and abuse protection (condition 2)**
- `POST /api/auth/recovery` takes `{ code }` **only**. Revision 2 proposed per-handle limits, which would have needed a handle in the input and let anyone test whether a handle exists; that is withdrawn.
- **Lookup:** normalise (upper-case, strip `-` and spaces, check the alphabet), compute the HMAC, then one indexed lookup. Wrong or used codes and wrong-format input all return the same `401 recovery_invalid` after the same work, so there's no oracle.
- **Atomic consumption:** `update recovery_codes set used_at = now() where code_hash = $1 and used_at is null returning account_id`.
- **Rate limits, applied before lookup:**
  - **per IP** (IPv6: per /64): 5 attempts per 15 minutes;
  - **per /24 network** (IPv6: per /48): 20 per hour;
  - **no global block** (Increment 2a review, correction C). A shared global ceiling would let one attacker exhaust it and lock every learner out of recovery.

  Global volume above 300 per hour only records one `recovery_flood` security event per hour for operators. At 80 bits, guessing a code is infeasible however many networks an attacker uses. The per-source limits exist to stop noise and denial of service.
- **Logging (revised in the Increment 2a review):** failed attempts are **not** stored one security-event row each. A row per failure would let an attacker turn guessing into unbounded database writes. Instead:
  - the API counts outcomes in fixed hourly windows and writes **one** structured log line per window: `{"event":"recovery_attempts_hourly","windowStart","attempts","succeeded","invalid","rateLimited"}`. It holds counts only, never a code, IP address or account. Memory is constant, and the line goes to the application log (14-day retention, F6).

    There is no timer: a window's line is written when the first attempt of a later window arrives, so a quiet period delays it, and a restart loses the open window's counts;
  - a global spike still writes one `recovery_flood` security event per hour;
  - each **successful** redemption writes a `recovery_code_used` security event, in the same transaction that consumes the code.

  This replaces the earlier rule that every failure counts in a security event.
- **Atomic redemption:** consuming the code, revoking the account's other sessions, creating the recovery session and writing `recovery_code_used` are **one transaction**. If any step fails, the code stays unused and nothing else changes. The consumed code row stays locked until commit, so of several simultaneous uses at most one succeeds.

**The recovery session and replacing an identity (condition 1)**
- A successful code gives a session with `scope='recovery'`, valid 15 minutes.
  - On entry, **all other sessions** of the account are revoked.
  - The dashboard later shows "A recovery code was used on {date}" and suggests regenerating codes.
- **Replacing an identity**, even with the same provider:
  1. The user chooses "Replace GitHub" or "Replace Nostr".
  2. The API creates a challenge with `purpose='replace'`, bound to the recovery session, the target provider and the pre-auth cookie.
  3. The provider flow runs as for sign-in: GitHub OAuth with PKCE, or Nostr as in F2.
  4. On success, **one transaction**:
     - checks the new `(provider, provider_uid)` is not linked to **another** account (409 `identity_in_use` if it is);
     - deletes the account's existing identity for that provider;
     - inserts the new one;
     - writes a security event.

  `unique(account_id, provider)` holds at every point, so legitimate recovery is always possible. If the new identity is the same as the old one (for example, someone regained their GitHub account), the step is a no-op success.
- **A full, freshly re-authenticated session** may also replace an identity. For example, someone who still has Nostr can swap GitHub accounts.
- **The last identity** still can't be removed without a replacement.

**Removal when access is truly lost (condition 3).** These are two different actions:

| Action | Effect | Reversible | Evidence required | Approval |
|---|---|---|---|---|
| **Emergency unpublication** | `visibility='private'`, the unlisted token cleared; data kept | yes: the owner can republish after signing in | *Reasonable evidence*: a request from a linked identity's public channel (an issue opened by that GitHub login, a note signed by that npub); or a credible report of impersonation, harassment or exposed personal data | one maintainer; logged in `admin_actions`; the owner sees a notice at next sign-in |
| **Account deletion** | Cascading delete of all rows | **no** | *Strong evidence*: proof of control of a linked identity at the time of the request, either a GitHub-authenticated request through the app or a Nostr event signed by the linked pubkey for a maintainer-issued challenge. Or a legal obligation reviewed by Bitsacco | **two** maintainers; logged with `account_id` nulled after deletion |

- **Without strong evidence,** only unpublication is done. Data-protection law (for example Kenya's Data Protection Act 2019 and Tanzania's Personal Data Protection Act 2022) may impose further duties. The procedure gets **legal review by Bitsacco before general release**.
- **Admin actions** are a CLI against the API with a separate admin credential. There is no web admin UI in Phase 3.

**Deferred (condition 4):** automatic unlisting after inactivity is not part of the authentication release.

**Security tests (written with Increment 2a)**
- **Codes:**
  - each code works once;
  - the 21st of 20 concurrent uses of one code still gives exactly one success;
  - regenerating invalidates the whole previous set;
  - the same 401 comes back for an unknown code, a used code, a malformed code and an empty input.
- **Rate limits:**
  - per IP and per /24, each returning 429, with no account identifier accepted or echoed;
  - exhausting one source never limits another;
  - global volume only alerts, never blocks.
- **The recovery session:**
  - it revokes other sessions;
  - it gets 403 on every route outside its allowlist;
  - it expires at 15 minutes.
- **Replacement:**
  - same-provider replacement swaps the identity in one transaction;
  - replacing with an identity linked elsewhere gives 409 and leaves both accounts unchanged;
  - replacement keeps `unique(account_id, provider)` and `unique(provider, provider_uid)`.
- **Concurrency and conflicts** (revision 3.1):
  - two concurrent replacements of the same provider on one account → exactly one commits (`select … for update` on the account's identity row inside the transaction), and the other gets `409 replace_conflict`;
  - concurrent replacement plus sign-in with the old identity → the old identity's sessions are revoked, and a sign-in with it after commit fails;
  - two accounts racing to link the same new identity → `unique(provider, provider_uid)` lets exactly one win, and the loser gets `409 identity_in_use` with its account unchanged;
  - linking an identity already associated with another account (sequential case) → 409, neither account changed.
- **Expiry and reuse:**
  - an expired recovery session (after 15 minutes), or one revoked by a later sign-in, gets 401 on every route, including a replacement callback that completes after expiry;
  - a `replace` challenge can't be reused, and isn't valid for `signin` or `link`;
  - a recovery code already consumed fails, including when two requests present it at the same moment.
- **Admin actions:**
  - unpublish makes HTML and API 404 at once and is reversible;
  - delete requires two approvals and cascades every table.
- **Logging:** security events contain no codes, tokens or full IP addresses.

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
- **Reverse-proxy logs (Increment 2a review):**
  - nginx access logs record the path, never the query string. That includes requests nginx rejects itself.
  - Access logs truncate client addresses to /24 (IPv4) or /48 (IPv6).
  - **Known limitation:** nginx error lines quote the full request line and the full client address, and nginx cannot redact them. They stay on at the normal level, because operators need them in an outage.
  - The three GitHub callback paths are the only `/api/` URLs carrying secrets (OAuth `code` and `state`), so they alone log errors only at `crit` and above.
  - Error logs are operator-only, held to the same 14-day retention, and enforced by the host, since Compose bounds size only.
  - The TLS front proxy's own logs must also leave out the callback query strings. That is a deployment gate item.
- **Trusted proxy (deployment gate):**
  - The API never reads `X-Forwarded-For`. It takes `X-Real-IP` only from a private peer, and nginx always overwrites `X-Real-IP` itself.
  - Behind the production HTTPS proxy, nginx's realip stanza must trust that proxy's address range alone. Otherwise every learner shares one rate-limit bucket.
  - This is verified against a stand-in proxy (`scripts/check-proxy.sh`). It must be verified again against the real proxy before go-live.

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

**Order after this PR merges:**
1. **2a:** API foundation, GitHub sign-in, sessions, recovery.
2. **2b:** NIP-07.
3. **2d:** linking and settings.
4. **3:** profiles and community.
5. **5:** dashboard.

Then:
- **2c (NIP-46)** is built when ready, but **released** only after the interop gate.
- **4 (GitHub contributions)** doesn't start until the installation-token investigation (G4) has actually been run and its outcome approved.

### H3. Release gate (every increment)

Nothing is released unless all of these hold:
- **Localization:** every new string exists in Kiswahili and English (parity tests pass), and terminology still pending review is marked as such.
- **Security boundaries:** every security boundary in the increment is covered by a test that ran in CI; any boundary not yet verified is listed as such in the PR.
- **Budgets:** the JS budgets pass, and the measured JS change on learning pages is reported in the PR.
- **Phase 1 and 2:** the existing behaviour still passes (the full Playwright suite plus the lab job).
- **Admin removal:** for auth releases, the administrative removal procedure has had legal review before **general** release (F5).

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

  **Increment 2a review, 2026-11-04:**
  - The project maintainer, a native Kiswahili speaker, reviewed the existing Kiswahili account phrases and the eight terms Increment 2a recorded as pending. Those eight are: sign in, sign out, account, session, recovery code, identity, replace, re-authenticate.
  - Decision: **approved without wording changes**. `content/terminology-review.json` records the approval.
  - The approval covers that existing content only. Terms from later increments still go through review before release.

---

## I. Open items before Increment 2

| # | Item | Owner | Blocks |
|---|---|---|---|
| 1 | ~~Merge PR #5~~ **Done** (`254e757`) | Maintainer | n/a |
| 2 | ~~Approve F5 and E2~~ **Approved**. Review revision 3.1's unlisted-link change (token in the URL fragment, E2) | Maintainer | 3 |
| 0 | Review and merge the Phase 3 design PR (#6) | Maintainer | All implementation |
| 3 | Provide the test GitHub App credentials (no permissions, personal account) through a secure channel, never in chat, commits, screenshots or logs | Maintainer | 2a and G4 |
| 4 | Run the G4 installation-token check; if it fails, bring back the evidence and the smallest alternative. No stored user tokens | Claude runs it; maintainer decides | 4 |
| 5 | ~~Approve the sign-in page's `wss:` policy~~ **Approved with conditions** (F3) | n/a | n/a |
| 6 | An Android phone and two independent NIP-46 signers for interop testing | Maintainer or volunteer | 2c release (not 2a or 2b) |
| 7 | DNS for `jifunze.bitsacco.com` and a staging host | Maintainer | Deployment |
| 8 | Appoint Kiswahili reviewers (Kenya and Tanzania); legal review of the removal procedure (F5) | Maintainer and Bitsacco | Release of affected terminology and auth |

### Risks

- **Profile metadata.** With live data, link previews are generic. A per-profile head subset can be added later.
- **API downtime** takes the community pages offline, by design: they fail closed and never show stale data.
- **G4 may fail.** Fallback (a) keeps privacy, but there would be no scheduled sync for those builders.
- **Mobile Nostr** depends on signer interoperability, which must be proven on real devices.
- **New operating surface:** secrets, backups and migrations. Section E5 lists the runbook items, and Increment 6 delivers it.
- **The header has about 1.3 KB of JS headroom on lessons.** Every header change is measured.
