# Phase 3: GitHub, Nostr and the builder ecosystem: design proposal

Status: **proposal for maintainer review.** No Phase 3 application code exists yet. The decisions in section I need approval before Increment 2 starts.

Journey: **Jifunze → Jaribu → Jenga → Changia → Kua** (Learn → Practise → Build → Contribute → Grow).

---

## A. Repository assessment (verified 2026-11-04)

### What is on `main`

`main` is at `ee7b35b`, the merge of PR #3, and its CI run passed. It contains:

- **v1 (PR #1).** Thirty-three bilingual MDX lessons across three paths, quizzes, a 50-term glossary, a library, and local-first progress with export and import. It also includes the service worker and the Docker regtest Lightning lab with its stdlib Python bridge on `127.0.0.1:7777`.
- **Phase 1 (PR #2).**
  - Lesson reader: course sidebar, table of contents and reading progress.
  - Home path cards with continue learning.
  - Catalogue `/{lang}/learn/` and roadmap badges.
  - Sitemap and robots.
  - Playwright and axe in CI.
- **Phase 2 (PR #3).**
  - Learning trees at `/{lang}/tree/{path}/`.
  - UTXO and channel-balance simulations under `/{lang}/simulations/`.
  - The seven review fixes.
  - The CI fix that stops header links prefetching.

### The homepage polish is not on `main`

**PR #4 shows as merged, but its changes never reached `main`.** PR #4 merged into `feat/phase-2-ux` at 21:02:41, which was 106 seconds after `feat/phase-2-ux` had already merged into `main` (21:00:56).

- **Where it is now.** Its 21 files are on `origin/feat/phase-2-ux` (tip `1796054`): the compact sticky header, the learning journey, the resource cards, the footer, the 360 px fix and the prefetch fix.
- **The fix.** One PR, `feat/phase-2-ux → main`, whose diff is exactly those 21 files. See decision **D1**.
- **Why it blocks Phase 3.** Phase 3's navigation builds on that header, so Phase 3 must start from `main` after D1.

### Architecture constraints Phase 3 must respect

| Area | Current state | Consequence for Phase 3 |
|---|---|---|
| Build | `next.config.ts`: `output: "export"`, `trailingSlash: true` | There is no server runtime, so authentication needs a server component somewhere. |
| Hosting | Non-root nginx serves `out/`. The README says "There is no app server, database or secret." No deploy pipeline exists in the repo, and `SITE_URL` is a placeholder. | Phase 3 adds the first secrets, database and long-running process, so hosting is a new decision (**D3**). |
| CSP | `scripts/postbuild.ts` writes a per-page `<meta http-equiv="Content-Security-Policy">` with sha256 hashes of inline scripts. It sets `img-src 'self' data:`, `connect-src 'self'` and `form-action 'none'`. | A same-origin API keeps `connect-src 'self'`. GitHub avatars need `img-src` on builder pages (**D8**). |
| Service worker | Navigations are network-first and every same-origin navigation response is cached in `pages-v1`. `/sw/` and `/en/` RSC data files go to `data-v1`, and the static allowlist goes to `static-v1`. | Private data must never be in HTML or RSC payloads; it is fetched from `/api/*` only. The worker gets an explicit `/api/` and `/{lang}/account/` bypass. |
| JS budgets | Home 143.43 of 144.9 KB, lesson 146.02 of 147.3, lab 151.94 of 153.2, roadmap and tree 143.63 of 145.1, simulation 141.78 of 145, browser worst case 142.38 (figures from the polish branch). | Anonymous learning pages must gain **0 bytes** of JS. Account UI ships only on account routes. |
| Client dictionary | `lib/i18n.ts` (both languages) is bundled into every page through `LanguageSwitch`, an 8.86 KB gzip chunk. | Phase 3 strings go in server-only or route-local copy modules, as `lib/site-copy.ts` and `lib/simulations/copy.ts` already do, and never in the shared dictionary. |
| Progress | localStorage `jifunze:progress:v1` with `{completedAt?, quiz?: {correct,total,at}, lab?: {passed[]}}`. `mergeProgress` takes the union and the best score. | Account sync reuses `mergeProgress` on the server. |
| Search | `filterCatalog` matches title, description, section and slug in the **page language only**. | Measured: "pochi" on `/en/learn/` and "seed phrase" on `/sw/learn/` return nothing. Bilingual search is a real gap (Increment 3). |
| Tests | 121 unit tests and 148 browser tests in CI (axe, offline, budgets, 360 px). Lab job: 41 Python tests plus model solutions. | Every increment extends these suites and keeps them green. |

---

## B. Product design

### Identity: the baobab grows

The home page already tells the Mbuyu (baobab) story. Phase 3 extends that metaphor rather than adding a new visual system:

| Layer | Kiswahili | Meaning | Where it appears |
|---|---|---|---|
| Roots | **Mizizi** | Learning: completed paths, lessons and assessed exercises | Learning journey, dashboard "My learning" |
| Branches | **Matawi** | Skills and technologies (Lightning, Cashu, Rust and so on) | Profile skills, directory filters |
| Fruit | **Matunda** | Projects and verified open-source contributions | Featured work, contribution evidence |

The metaphor shapes structure and words, not decoration.

The one visual signature is the **Builder Journey**, a vertical stem that runs through a profile. Its nodes sit in three bands, roots at the bottom of the story and fruit at the top. It's built with plain CSS, like the learning tree: no animation library and no canvas.

**What stays:**
- Night `#1b2550` and earth `#170d09`, teal-700, sun-deep `#c94400` and dawn.
- The system font, the Bitsacco mark lockup and the 96rem container.
- Rounded-2xl cards and the dawn active marker.

**New tokens, few and purposeful:**
- **Evidence badge.** A teal check and the text "Imethibitishwa na GitHub / Verified on GitHub". It appears only next to records we fetched from GitHub's API.
- **Self-reported badge.** A neutral outline reading "Kutoka kwa mjenzi / Added by the builder", used for projects the builder entered.
- **Freshness line.** For example: "Synced from GitHub 3 hours ago · source".

**Not used, by design:** neon accents, terminal-style command banners, numeric reputation scores, leaderboards, streaks or badges for engagement.

### Navigation

Current header: Paths · Labs · Library · Glossary · Progress | Language.

Proposed header (decision **D2-nav**):

```
Desktop ≥1024px
┌──────────────────────────────────────────────────────────────────────────┐
│ (◎) Jifunze      Njia  Maabara  Wajenzi  Rasilimali ▾ │ English │ Ingia │
│     na Bitsacco                                                          │
└──────────────────────────────────────────────────────────────────────────┘
  Rasilimali ▾ = Maktaba (Library) · Kamusi (Glossary) · Mazoezi (Practice)
  · Maendeleo (Progress)
  Signed in, "Ingia" becomes the avatar menu: Dashibodi · Wasifu wangu
  (My profile) · Akaunti zilizounganishwa (Connected accounts) · Mipangilio
  (Settings) · Toka (Sign out)

Phone <1024px
┌────────────────────────────────────┐
│ (◎) Jifunze      English  (☺) [≡] │   (☺) = Sign in or avatar menu
│     na Bitsacco                    │
└────────────────────────────────────┘
```

- **Four top-level destinations** (Paths, Labs, Builders, Resources) plus language and account. Progress moves into Resources, and for signed-in users it is also on the dashboard.
- **Zero shared JS.** "Ingia" and the avatar menu are both static HTML `<details>` elements.
  - A ~150-byte inline script, already allowed by the per-page CSP hash, reads a non-secret cookie `jf_signed_in=1` and sets `html.signed-in`.
  - CSS then shows the avatar menu instead of "Ingia".
  - The avatar image and name load only on account pages. In the header the avatar is a generic glyph, so no request is made for every page view.
- **Sign out** is a link to `/{lang}/account/signout/`, which runs the POST from the account bundle. Learning pages keep `form-action 'none'`.

---

## C. User journeys

1. **Anonymous learner.** Opens `/sw/`, reads and practises with no account, and progress stays in localStorage as today. Nothing in Phase 3 changes this path.
   - No API call is made unless `jf_signed_in` is present.
   - An optional "Hifadhi maendeleo kwenye akaunti / Save progress to an account" prompt appears only on `/progress/` and on finishing a path. It never appears mid-lesson.
2. **GitHub builder.**
   - Chooses "Endelea na GitHub", which goes to `/api/auth/github/start?lang=sw&return=/sw/builders/` and then to GitHub's consent screen. The app requests **no permissions**, so GitHub shows identity only.
   - The callback creates the account with the preferred language. The user lands on `/sw/account/welcome/`.
   - They choose a profile handle (defaulting to their GitHub login), write bios in Kiswahili and/or English, and pick skills.
   - They decide whether the profile is **private, unlisted or public** (default private), then import contributions.
   - Publishing makes the profile appear in the directory after the next site build (section E).
3. **Nostr builder.**
   - Chooses "Endelea na Nostr".
   - If a NIP-07 extension is present, the page asks it to sign a one-time login event (section F).
   - If not, the page explains signer options and, from Increment 2b, offers NIP-46 (a QR or `bunker://`).
   - After signing in, the account and profile steps match the GitHub journey. Linking GitHub later requires completing GitHub sign-in while signed in.
4. **Returning learner with local progress.**
   - After the first sign-in, the dashboard shows "Maendeleo kwenye kifaa hiki / Progress on this device: 9 lessons", with **Merge into my account** or **Not now**.
   - Merging uses the existing union/best rule. Local data is never overwritten; both sides keep the merged result.
   - On later devices the same offer appears when local and account progress differ.
5. **Public profile visitor.**
   - Opens `/en/builders/` and filters by "Lightning" or searches "cashu".
   - Opens `/en/builders/{handle}/` and reads the Builder Journey. Each contribution links to the original GitHub PR, with merged status and date, and a "last synced" line.
   - No sign-in is needed, and the page works offline once visited, because it is static.

---

## D. Wireframes (desktop and phone)

Sizes follow the existing scale. Every page has Kiswahili and English text; Kiswahili is shown here.

### D1. Sign-in `/{lang}/account/signin/`

```
Desktop                                         Phone
┌───────────────────────────────────────┐       ┌──────────────────────────┐
│ Ingia kwenye Jifunze                  │       │ Ingia kwenye Jifunze     │
│ Huhitaji akaunti kusoma masomo.       │       │ Huhitaji akaunti kusoma  │
│                                       │       │ masomo.                  │
│ ┌───────────────────────────────────┐ │       │ ┌──────────────────────┐ │
│ │ [GitHub] Endelea na GitHub        │ │       │ │ Endelea na GitHub    │ │
│ └───────────────────────────────────┘ │       │ └──────────────────────┘ │
│ ┌───────────────────────────────────┐ │       │ ┌──────────────────────┐ │
│ │ [Nostr]  Endelea na Nostr         │ │       │ │ Endelea na Nostr     │ │
│ └───────────────────────────────────┘ │       │ └──────────────────────┘ │
│ Tunachopokea: jina lako la GitHub au  │       │ Tunachopokea ▸           │
│ ufunguo wa umma wa Nostr. Hatupokei   │       │ (details, closed)        │
│ nsec, barua pepe wala hazina binafsi. │       │                          │
│ Lugha: Kiswahili ▾ (stays after login)│       │ Lugha: Kiswahili ▾       │
└───────────────────────────────────────┘       └──────────────────────────┘
States: no NIP-07 signer → panel "Huna kisaini cha Nostr" with options;
GitHub denied or expired → error banner with "Jaribu tena"; signing in → aria-busy.
```

### D2. Builder directory `/{lang}/builders/`

```
Desktop
┌──────────────────────────────────────────────────────────────────────┐
│ Wajenzi wa Bitcoin                                                   │
│ Watu wanaojenga Bitcoin, Lightning, Cashu, Fedimint na Nostr.        │
│ [ Tafuta jina, mradi au ujuzi…            ]                          │
│ (Bitcoin) (Lightning) (Cashu) (Fedimint) (Nostr) (Rust) (TypeScript) │
│ Lugha: [Zote ▾]   Shughuli: [Siku 90 zilizopita ▾]    24 wajenzi     │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐ │
│ │ (img) Amina K.  ✓GH  │ │ (img) Juma M.  ✓GH ⚡│ │ …              │ │
│ │ @aminak · Kisw, Eng  │ │ @jumam · Kiswahili   │ │                │ │
│ │ Lightning · Rust     │ │ Cashu · TypeScript   │ │                │ │
│ │ "Ninajenga zana za   │ │ Mradi: cashu-ke      │ │                │ │
│ │  malipo kwa chama"   │ │                      │ │                │ │
│ │ 12 PR zimeunganishwa │ │ 3 PR · 5 mapitio     │ │                │ │
│ │ Hai: siku 90 ⓘ       │ │ Hai: siku 90 ⓘ       │ │                │ │
│ └──────────────────────┘ └──────────────────────┘ └────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
Phone: one column; filters in a horizontally scrolling chip row inside the
page (no page overflow); the count sits above the list.
✓GH = verified GitHub · ⚡ = has Nostr identity (shown only if the builder
chose it). "Hai: siku 90" ⓘ = at least one merged PR or review in a public
repo in the last 90 days, per GitHub at last sync.
Empty: "Hakuna mjenzi anayelingana" + clear filters. No JS: the full list
renders; the search island is progressive.
```

### D3. Public builder profile `/{lang}/builders/{handle}/`

```
Desktop
┌──────────────────────────────────────────────────────────────────────┐
│ (avatar) Amina Kariuki                       Lugha: Kiswahili, English│
│ @aminak on GitHub ✓    npub1…x9 (Nostr) ✓                            │
│ Bio [Kiswahili] [English]  ← tabs exist only for bios the builder    │
│ wrote; a missing language says "Imeandikwa kwa Kiingereza"           │
│ Ujuzi: Lightning · Rust · Fedimint                                   │
├───────────────────────────── Safari ya Mjenzi ───────────────────────┤
│  MATUNDA ● Merged PR #812 lightningdevkit/rust-lightning  Okt 2026 ↗ │
│          ● Mradi: chama-payouts (Added by the builder)               │
│  MATAWI  ● Ujuzi: Rust, Lightning                                    │
│  MIZIZI  ● Imemaliza: Lightning kwa Wajenzi (17/17)      Sep 2026    │
│          ● Imemaliza: Bitcoin kwa Wajenzi                Ago 2026    │
├──────────────────────────────────────────────────────────────────────┤
│ Kazi teule (Featured work)  [card] [card]                            │
│ Michango ya chanzo huria                                             │
│  [Imeunganishwa 12] [Imefunguliwa 3] [Mapitio 9] [Nje ya miradi yake]│
│  list: repo · PR title · state · date · ↗ link to github.com         │
│  "Kutoka GitHub, ilisawazishwa 26 Okt 2026 14:00. GitHub inaonyesha  │
│   michango ya umma pekee; si kila mchango unaonekana."               │
└──────────────────────────────────────────────────────────────────────┘
Phone: the header stacks; the Journey becomes a single column with band
labels inline; contribution filters are a select.
```

### D4. Dashboard `/{lang}/account/` (client shell, noindex, never cached)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Habari, Amina                                   [Tazama wasifu wangu]│
│ Hatua inayofuata: ▶ Endelea: "Uelekezaji wa malipo" (Lightning 9/17) │
├──────────────┬──────────────────────────┬────────────────────────────┤
│ Mafunzo yangu│ Kazi yangu               │ Miunganisho                │
│ Njia 3       │ Kazi teule 2 [+ Ongeza]  │ GitHub ✓ @aminak           │
│ ▓▓▓▓░░ 9/17  │ PR 12 · mapitio 9        │ Nostr  ✓ npub1…x9          │
│ Maendeleo ya │ Ilisawazishwa saa 3      │ [Simamia]                  │
│ kifaa hiki:  │ zilizopita [Sawazisha]   │                            │
│ [Unganisha]  │ Mapya 4: [Kagua]         │ Wasifu: Umma ✓             │
├──────────────┴──────────────────────────┴────────────────────────────┤
│ Shughuli za hivi karibuni: lesson completed · PR merged · project    │
└──────────────────────────────────────────────────────────────────────┘
Phone: one column in priority order: next step, learning, work,
connections, activity.
```

### D5. Settings `/{lang}/account/settings/`

```
┌─────────────────────────────── Mipangilio ───────────────────────────┐
│ Lugha unayopendelea: (•) Kiswahili ( ) English                       │
│ Wasifu: ( ) Binafsi  ( ) Bila kuorodheshwa  (•) Umma                 │
│ Onyesha: [✓] Safari ya mafunzo  [✓] Nostr npub  [ ] Michango ya nje  │
│ Akaunti zilizounganishwa:                                            │
│   GitHub @aminak   ✓ tangu 12 Okt  [Ondoa]                           │
│   Nostr  npub1…x9  ✓ tangu 14 Okt  [Ondoa]                           │
│   (Ondoa is disabled on the last identity, with an explanation)      │
│ Vipindi (sessions): kifaa hiki · Chrome Android · [Toka vingine vyote]│
│ Data: [Pakua data yangu (JSON)]   [Futa akaunti…] (re-auth required) │
└──────────────────────────────────────────────────────────────────────┘
```

### D6. GitHub connection and sync

```
┌─────────────── GitHub ────────────────┐   States
│ ✓ Imeunganishwa kama @aminak          │   idle · syncing (progress, aria-live)
│ Tunasoma michango ya UMMA pekee.      │   · done (N new, review) · rate-limited
│ Ilisawazishwa: 26 Okt 14:00           │   ("tutajaribu tena saa 14:40")
│ [Sawazisha sasa] (max once an hour)   │   · revoked ("unganisha upya")
│ Mapya tangu mara ya mwisho: 4 [Kagua] │   · error (code + retry)
└───────────────────────────────────────┘
```

---

## E. Architecture

### Options compared

| Criterion | **A: static site + small same-origin API** | B: server-capable Next.js |
|---|---|---|
| Migration risk | Low: learning pages, CSP hashing, service worker and budgets untouched | High: `output: "export"` goes, per-page CSP meta hashing does not apply to dynamic pages (nonces make routes dynamic), and the service worker's export path rules (`index.txt`, `__next.*`) and offline tests need rewriting |
| Engineering | A second small codebase (`api/`) with its own tests | One codebase, but auth logic shares a process with page rendering |
| Operations | nginx, a Node API and PostgreSQL | Node server and PostgreSQL |
| Hosting cost | One small VM or container host, or a PaaS, plus managed Postgres (≈ $10–25/month at this scale) | Similar |
| Security | Clean boundary: no secret ever reaches the static build; one HttpOnly cookie; CSP unchanged | Server components near secrets; a risk of leaking private data into RSC payloads cached by the service worker |
| Performance | Learning pages unchanged; account pages load their own bundle | The risk of regressing static pages is real |
| SEO for profiles | Profiles and directory **pre-rendered at build** from a public snapshot; full HTML and OG tags | SSR or ISR with instant freshness |
| Freshness | A new or edited public profile appears after the next build (target ≤ 10 min, via a publish-triggered rebuild) | Immediate |
| Offline | Unchanged; public profiles are cacheable static pages | Needs re-verification |
| Testing | API: unit and integration against Postgres; site: existing suites | Re-baselining all offline and CSP tests |

**Recommendation: A.**

- **It's the smallest safe change.** The learning platform stays a static export behind nginx. Nginx proxies `/api/*` to one Node 24 + TypeScript service on the same origin, so there's no CORS and the session cookie is first-party.
- **Database.** The service uses **PostgreSQL 16**.
- **Public builder pages** are generated at build time from `GET /api/public/snapshot`. The cost is profile freshness measured in minutes, which suits portfolios.
- **Revisiting B.** Only worth it if near-instant publication becomes a hard requirement.

### Components

```
Browser ── https://jifunze.example ──┐
                                     ▼
                          nginx (existing container)
             /, /_next/, /sw.js ...  │   /api/*  (proxy, Cache-Control: no-store)
             static export (out/)    │──────────────► api (Node 24, TypeScript)
                                                        │  ├─ GitHub OAuth (server-side secret)
                                                        │  ├─ Nostr verification (@noble/curves)
                                                        │  ├─ sessions, profiles, sync job
                                                        ▼  └─ snapshot for builds
                                                    PostgreSQL 16
Build (CI or deploy hook): fetch /api/public/snapshot → generateStaticParams
for /{lang}/builders/{handle}/ → static export → image.
```

- **API dependencies** (decision **D11**):
  - `postgres` for the database driver.
  - `@noble/curves` and `@noble/hashes` for BIP-340 Schnorr verification and SHA-256. They're audited and small.
  - The existing `zod` for input validation.
  - HTTP via `node:http` with a small router, the same pattern as the lab bridge. No framework, ORM or queue.
- **Background sync** runs in-process: one interval loop guarded by a Postgres advisory lock (section G).

### Database schema (PostgreSQL)

```sql
create table accounts (
  id uuid primary key default gen_random_uuid(),
  preferred_lang text not null default 'sw' check (preferred_lang in ('sw','en')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table identities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  provider text not null check (provider in ('github','nostr')),
  provider_uid text not null,          -- GitHub numeric user id (stable) | Nostr hex pubkey
  handle text,                         -- GitHub login (can change; refreshed) | null for Nostr
  avatar_url text,                     -- GitHub only (avatars.githubusercontent.com)
  linked_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  revoked_at timestamptz,              -- GitHub app authorization revoked (webhook)
  unique (provider, provider_uid),     -- one identity can belong to one account only
  unique (account_id, provider)        -- one GitHub and one Nostr per account (Phase 3)
);

create table sessions (
  token_hash bytea primary key,        -- sha256 of a 32-byte random token; the token lives only in the cookie
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,     -- absolute 30 days; idle timeout 14 days
  reauth_at timestamptz not null default now(),  -- for sensitive actions (unlink, delete)
  user_agent text,
  revoked_at timestamptz
);

create table auth_challenges (         -- single-use OAuth state and Nostr challenges
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('signin','link','reauth')),
  provider text not null check (provider in ('github','nostr')),
  secret_hash bytea not null,          -- OAuth state or Nostr nonce, hashed
  pkce_verifier text,                  -- GitHub only; server-side, never sent to the browser
  account_id uuid references accounts(id) on delete cascade,  -- set for 'link' and 'reauth'
  binding_hash bytea not null,         -- sha256 of the pre-auth cookie value: ties the flow to one browser
  lang text not null check (lang in ('sw','en')),
  return_to text not null,             -- validated relative path under /sw/ or /en/
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,     -- 10 minutes (GitHub) | 5 minutes (Nostr)
  used_at timestamptz
);

create table profiles (
  account_id uuid primary key references accounts(id) on delete cascade,
  handle citext unique not null check (handle ~ '^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$'),
  display_name text not null check (length(display_name) between 1 and 80),
  bio_sw text check (length(bio_sw) <= 600),
  bio_en text check (length(bio_en) <= 600),
  languages text[] not null default '{}',       -- communication languages, e.g. {sw,en}
  skills text[] not null default '{}',          -- from a controlled vocabulary (content/skills.json)
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  show_nostr boolean not null default false,
  show_learning boolean not null default false,
  show_external_contributions boolean not null default true,
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  summary_sw text, summary_en text,
  repo_github_id bigint,                -- optional; verified to exist and be public at save time
  repo_full_name text,                  -- refreshed by sync (renames)
  url text check (url ~ '^https://'),
  tech text[] not null default '{}',
  position smallint not null default 0
);

create table contributions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  kind text not null check (kind in ('pr_opened','pr_merged','review')),
  repo_github_id bigint not null,
  repo_full_name text not null,
  repo_owner_is_builder boolean not null,
  pr_number integer not null,
  pr_url text not null check (pr_url like 'https://github.com/%'),
  pr_title text not null,
  state text not null check (state in ('open','merged','closed')),
  opened_at timestamptz not null,
  merged_at timestamptz,
  reviewed_at timestamptz,
  retrieved_at timestamptz not null,
  last_seen_at timestamptz not null,
  missing_since timestamptz,            -- set when not returned by GitHub; hidden after 2 misses
  unique (account_id, kind, repo_github_id, pr_number)
);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  trigger text not null check (trigger in ('initial','user','scheduled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','ok','partial','rate_limited','failed')),
  items_seen integer not null default 0,
  incomplete boolean not null default false,  -- GitHub reported incomplete_results or the 1,000 cap
  error_code text,
  retry_after timestamptz
);

create table learning_progress (       -- same shape as jifunze:progress:v1, one row per lesson
  account_id uuid not null references accounts(id) on delete cascade,
  lesson_key text not null check (lesson_key ~ '^(savers|builders|lightning)/[a-z0-9-]+$'),
  completed_at timestamptz,
  quiz_correct smallint, quiz_total smallint, quiz_at timestamptz,
  lab_passed text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (account_id, lesson_key)
);

create table security_events (         -- sign-in, link, unlink, delete; kept 90 days
  id bigserial primary key,
  account_id uuid,                     -- null after deletion
  event text not null,
  at timestamptz not null default now(),
  detail jsonb not null default '{}'   -- no tokens, no IPs beyond a /24 prefix
);
```

### API contracts

All routes are under `/api`. JSON in and out, unless stated otherwise.

- **Every response:** `Cache-Control: no-store`.
- **Every non-GET request** needs an `Origin` equal to `SITE_ORIGIN` and the header `X-Jifunze: 1`.
- **Errors** look like `{ error: { code, message_sw, message_en } }`.

| Method and path | Auth | Request | Response |
|---|---|---|---|
| GET `/auth/github/start` | none | `?lang=sw&return=/sw/builders/&purpose=signin\|link` | 302 to GitHub with `state` and S256 `code_challenge`; sets `__Host-jf_preauth` (HttpOnly, 10 min) |
| GET `/auth/github/callback` | pre-auth cookie | `?code&state` | 302 to `return`; sets `__Host-jf_session` and `jf_signed_in=1`; a failure returns 302 to `/{lang}/account/signin/?error=code` |
| POST `/auth/nostr/challenge` | none | `{ lang, return, purpose }` | `{ challengeId, url, method:"POST", expiresAt }`; sets `__Host-jf_preauth` |
| POST `/auth/nostr/verify` | pre-auth cookie; `Authorization: Nostr <base64 event>` | `{ challengeId, nonce }` | `{ return }` plus the session cookies |
| POST `/auth/logout` | session | none | 204; revokes the session and clears both cookies |
| GET `/me` | session | none | `{ account:{id,preferredLang}, identities:[{provider,handle,npub,linkedAt}], profile:{handle,visibility}\|null }` |
| PATCH `/me/preferences` | session | `{ preferredLang }` | 200 |
| DELETE `/me/identities/:provider` | session, re-auth ≤ 10 min | none | 204; **409 `last_identity`** if it is the only one |
| GET and PUT `/me/profile` | session | profile fields (zod-validated; handle uniqueness checked) | profile |
| GET, POST, PATCH, DELETE `/me/projects[/:id]` | session (owner only) | project fields | project or list |
| POST `/me/github/sync` | session; at most 1 per hour per account | none | 202 `{ runId }`; 429 with `retryAt` |
| GET `/me/github/sync/:runId` | session (owner) | none | the sync run |
| GET `/me/progress` | session | none | progress file v1 |
| POST `/me/progress/merge` | session | progress file v1 (validated by the existing parser) | merged progress file v1 |
| GET `/me/export` | session | none | all of the account's data (JSON download) |
| DELETE `/me` | session, re-auth ≤ 10 min | `{ confirm: handle }` | 204; cascades and triggers a rebuild |
| GET `/public/builders` | none | `?q&skill&lang&active=90d&cursor` | public cards only |
| GET `/public/snapshot` | build token (CI secret) | none | every public profile with its public contributions, for static generation |
| POST `/github/webhook` | `X-Hub-Signature-256` HMAC | `github_app_authorization` (revoked) | 204; marks the identity revoked and stops sync |

**Rules for every account route:** the account comes only from the session, never from a request parameter. Every query that touches a row also checks `account_id = session.account_id`, which closes the IDOR gap.

---

## F. Security

### Threat model

| Asset or flow | Threat | Control |
|---|---|---|
| GitHub OAuth | CSRF or login fixation via a forged callback | Server-side single-use `state` stored as a hash, bound to an HttpOnly `__Host-jf_preauth` cookie (10 min); exact registered `redirect_uri`; PKCE S256 with the verifier kept server-side ([GitHub docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app), [changelog](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/)) |
| GitHub identity | Trusting a submitted username | Identity = `GET /user` with the freshly exchanged token; the key is the numeric `id`, and the login is display data only |
| GitHub tokens | Token theft from the database or logs | **Not stored (recommended, D5).** The token is used once for `/user` and then discarded. Public data is synced with the app's own installation token (section G). If D5 is rejected: AES-256-GCM at rest, refresh-token rotation, purge on revoke |
| Nostr login | Forged or replayed signatures | NIP-98-style kind 27235 event ([NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md)), detailed below |
| Nostr keys | Key exposure | The site never asks for or accepts an `nsec`; there is no key field anywhere; signing happens only in the user's signer (NIP-07 extension or a NIP-46 remote signer) |
| Account linking | Takeover by linking someone else's identity | Linking requires a signed-in session **and** a fresh proof from the new identity, through a challenge with `purpose='link'` bound to the current `account_id` and pre-auth cookie. `unique(provider, provider_uid)`. Never merge on usernames, emails, bios or Nostr metadata |
| Identity already linked elsewhere | Silent merge or theft | Refuse with 409 `identity_in_use` and explain that it belongs to another Jifunze account (sign in with it to manage or delete that account). No automatic merge in Phase 3 |
| Sessions | Fixation or theft | A new random token on every sign-in, link and re-auth; the cookie is `__Host-jf_session` (HttpOnly, Secure, SameSite=Lax, Path=/); stored as a SHA-256 hash; 14-day idle and 30-day absolute expiry; "sign out other sessions" |
| CSRF on the API | Cross-site state change | SameSite=Lax, plus an exact `Origin` check on non-GET requests, plus the `X-Jifunze: 1` header (a cross-origin sender would need a preflight, which the API never grants: no CORS headers) |
| XSS via profile content | Script injection in bios or projects | Plain text only (no Markdown or HTML in Phase 3); React escaping; length limits; URLs restricted to `https:`; the CSP stays hash-based with no `unsafe-eval` |
| IDOR | Editing another person's profile or projects | The account always comes from the session; rows are scoped by `account_id`; tests try cross-account IDs |
| Service worker | Private data in public caches | Private data is only ever fetched from `/api/*`; the worker never handles `/api/` and skips `/{lang}/account/*`; account pages are static shells with no private HTML; sign-out clears nothing because nothing private is cached. A test asserts that no `/api` response or account page reaches any cache |
| External API data | Malicious titles, oversized responses | zod-validate GitHub responses; cap stored text lengths; only `https://github.com/…` PR URLs |
| Rate limits and abuse | Brute force, sync floods | Per-IP limits on `/auth/*`; one user sync per hour; global sync concurrency 2; GitHub 403/429 honoured with `Retry-After` and `x-ratelimit-reset` |
| Webhook | Forged revoke events | HMAC-SHA256 verified with a constant-time compare against the app's webhook secret |
| Account deletion | Leftover public data | Cascading delete, then a rebuild removes static pages; the security event keeps no personal data |

### Nostr verification

`POST /api/auth/nostr/verify` accepts the request only if **all** of these hold:

1. `kind == 27235`.
2. `id == sha256(serialized event)`.
3. A valid BIP-340 Schnorr signature by `pubkey`.
4. `created_at` within ±60 s of server time.
5. The `u` tag equals exactly `https://<SITE_ORIGIN>/api/auth/nostr/verify`, which binds the event to this application.
6. `method == "POST"`.
7. The `payload` tag equals sha256 of the exact request body `{"challengeId":…,"nonce":…}`.
8. The challenge exists, matches the pre-auth cookie binding, is unexpired (5 min) and is unused. It is consumed atomically with `update … set used_at = now() where id = $1 and used_at is null returning …`.

Replays fail on rule 8; events for other sites fail on rule 5.

**Signer support:**
- **Increment 2a: NIP-07** (`window.nostr.signEvent`).
- **Increment 2b: NIP-46** ([spec](https://github.com/nostr-protocol/nips/blob/master/46.md)). This is the realistic mobile path: a `nostrconnect://` QR or a pasted `bunker://` URI. The identity is the pubkey returned by `get_public_key`, not the remote-signer key.
- **Not promised:** compatibility with specific apps. The page states what it needs ("a signer that supports NIP-07 or NIP-46") and the errors name what was missing.

### Identity and recovery rules

- An account can hold at most one GitHub and one Nostr identity.
- **The last identity can't be removed** (409). The settings page recommends linking both providers for recovery.
- There is no email or password recovery in Phase 3 (**D9**). If someone loses their only identity, the account can't be recovered, and the UI says so plainly before they publish.
- Unlinking and deletion require re-authentication within 10 minutes, with the identity being kept, or either identity for deletion.

### Privacy

- **Profiles default to private.** The directory lists only `visibility='public'`.
- **Unlisted** profiles have a page, marked `noindex`, but are not in the directory or sitemap.
- **Learning history and the Nostr identity** are hidden until the builder turns them on.
- **Only builders who signed up are shown** (recommended, **D7**). Jifunze does not list GitHub contributors who never signed up; public data on GitHub is not consent to a Jifunze profile.
- **What's collected:**
  - GitHub: numeric id, login and avatar URL.
  - Nostr: the pubkey.
  - No email, no Nostr kind-0 metadata and no IP addresses stored beyond a /24 prefix in security events.
- **Avatars:** builder pages add `img-src https://avatars.githubusercontent.com` (**D8**). Nostr profile pictures, which are arbitrary URLs, are not shown; Nostr-only builders get a generated initial avatar.
- **Data controls:** export everything (`GET /me/export`) and delete everything (`DELETE /me`).

---

## G. GitHub integration

### Data sources and verified fields

| Data | Source | Stored evidence | Limits ([search docs](https://docs.github.com/en/rest/search/search)) |
|---|---|---|---|
| Identity | `GET /user` with the one-time user token | `id`, `login`, `avatar_url` | none |
| Merged PRs | Search: `is:pr is:merged author:{login}` | repo id and full name, number, URL, title, `merged_at` (via the PR endpoint for each new item), `retrieved_at` | At most 1,000 results per query, 30 requests per minute; `incomplete_results` is recorded |
| Opened PRs (open or closed) | Search: `is:pr author:{login}` | as above, with state | as above |
| Reviews | Search: `is:pr reviewed-by:{login} -author:{login}` | PR identity plus `reviewed_at` (the reviews endpoint, filtered to the user id) | as above; only reviews visible publicly |
| Outside own repos | Derived: `repo_owner_is_builder = (repo.owner.id == identity.provider_uid)` | boolean | org-owned repos count as "outside" unless the builder owns the org (not inferred in Phase 3) |
| Repositories (for featured projects) | `GET /users/{login}/repos?type=owner&sort=pushed` | id, name, language, stars (shown only on project cards) | Public only; forks are flagged as forks |
| Languages and skills | Repository `language` informs suggestions; the builder chooses skills | Builder-chosen skills (controlled list) | GitHub's language field is a heuristic, so it is never shown as "skills" by itself |

**What the platform won't claim:**
- **No complete history.** Search caps results at 1,000 per query and ignores private work.
- **No "commits contributed".** A commit appearing in a repo is not proof of authorship by this account, so commit counts are not displayed.
- **No unbounded contribution-calendar totals.** `contributionsCollection` is reported to be limited to one-year windows; this will be verified in the Increment 4 spike before any use.

**Display:**
- **Counts are evidence lists.** "12 merged" opens the list of the 12 PRs, each linking to GitHub.
- **Every list carries a footer:** "From GitHub's public search, synced {date}. GitHub returns at most 1,000 results per query and does not show private work."
- **"Active (90 days)":** at least one merged PR or review with a timestamp in the last 90 days at the last sync. The definition is shown in the ⓘ tooltip, which is also available as text.

**Bitcoin ecosystem relevance (D10):**
- A reviewed `content/ecosystem.json` lists organisations and repos by technology, for example bitcoin/bitcoin, lightningnetwork/lnd, lightningdevkit/*, ElementsProject/lightning, cashubtc/*, fedimint/*, nostr-protocol/*, bitsacco/*.
- A contribution is tagged "Lightning" and so on only if its repo matches. This powers the directory filters together with the skills the builder chose.
- No score.

### Synchronisation

- **Credential:** the GitHub App's **installation token** on the Bitsacco organisation (D4). It reads public data only. The Increment 4 spike verifies that installation-token search covers public repositories across GitHub; if not, the fallback is D5's encrypted user tokens.
- **Triggers:**
  - The initial import when a profile is created.
  - A user refresh, at most once an hour.
  - A scheduled daily refresh of public profiles, run as an in-process loop under `pg_try_advisory_lock`, two accounts at a time.
- **Idempotent:** upserts on `unique(account_id, kind, repo_github_id, pr_number)`. Renamed repos keep their `repo_github_id` and refresh `repo_full_name`.
- **Deletions:** an item not returned gets `missing_since`; after two consecutive misses it is hidden and noted as "no longer available on GitHub".
- **Backoff:** on 403 or 429, store `retry_after` from the headers and mark the run `rate_limited`. Retry with exponential backoff (1, 4 and 16 minutes, capped by the reset time).
- **Revocation:** the `github_app_authorization` webhook marks the identity `revoked_at`. Sync stops and the dashboard asks the builder to reconnect. Imported records stay hidden until they do.
- **Freshness:** shown everywhere stats appear ("Ilisawazishwa … / Synced …").

---

## H. Implementation plan

Each increment is its own branch and PR from an up-to-date `main`. Every increment must:
- keep `npm run check`, the build, `check:ux-budget`, the full Playwright suite and the lab job green;
- add 0 bytes of JS to anonymous learning pages (asserted by the budget gate);
- keep Kiswahili/English parity (parity tests for every copy module);
- use signed commits with no trailers.

| # | Increment | Scope | Key tests and acceptance criteria |
|---|---|---|---|
| 0 | Reconcile base | D1: integrate the homepage polish into `main` | `main` contains `88ca787`; CI green |
| 1 | Foundations (this document) | Approval of the D-list; spikes: (a) installation-token public search; (b) NIP-07 sign and verify against @noble/curves test vectors; (c) a hosting dry run for nginx, API and Postgres | Spike notes recorded; decisions logged |
| 2a | API skeleton and GitHub sign-in | `api/` service, migrations, sessions, GitHub start and callback, logout, `/me`, nginx proxy, a service-worker `/api` bypass, the header account control (static), sign-in page | State reuse, PKCE mismatch and expired state are all rejected; the session cookie has the right flags; the service worker never caches `/api` or account pages; zero JS added to learning pages; axe on sign-in in both languages |
| 2b | Nostr sign-in | NIP-07 challenge and verify; NIP-46 behind a feature flag if spike (b) is positive | Replay, stale `created_at`, wrong `u`, wrong payload, wrong kind and a bad signature are each rejected; the identity is the `get_public_key` result |
| 2c | Linking and settings | Link and unlink, re-auth, sessions list, language preference, export, delete | Linking an identity owned by another account gives 409; the last identity can't be removed; a cross-account IDOR test; deletion cascades |
| 3 | Profiles and discovery | Profile editor, visibility, bilingual bios, skills vocabulary, static directory and profile generation from the snapshot, directory search island, **bilingual catalogue search** (both languages' titles plus glossary synonyms) | "pochi" on `/en/learn/` and "seed phrase" on `/sw/learn/` find the wallet lesson; private and unlisted profiles are absent from the directory and sitemap; no-JS directory works; 360 px; axe |
| 4 | GitHub contributions | Search import, the evidence model, sync runs, backoff, webhook, the ecosystem list, freshness UI | Fixture-based tests for pagination, `incomplete_results`, renamed repos, deleted PRs and 429 handling; every displayed count links to its evidence; no commit counts |
| 5 | Dashboard and learning sync | Dashboard, explicit progress merge, projects, Builder Journey | Merge is deterministic (union and best score), local data is never discarded, offline learning still works, import and export still work |
| 6 | Hardening | Security review against section F, auth-failure and offline regression suites, low-end Android pass, documentation and runbook (secrets, backups, key rotation) | Report with evidence; no open Critical or Important findings |

### Bilingual delivery (all increments)

- **New copy** goes in route-local copy modules with parity tests, never in the shared client dictionary.
- **New glossary terms** are added with both languages and an editorial review flag. They include *pull request*, *code review*, *merge*, *repository*, *contributor*, *maintainer*, *signer*, *public key* and *remote signing*.
- **Translation review** (D12): one Kenyan and one Tanzanian reviewer approve new technical terms before release.
- **Language preference:**
  - It goes into OAuth `state` and the Nostr challenge.
  - The callback returns to the same language and page.
  - `accounts.preferred_lang` and a `jf_lang` cookie persist it.
  - The root `/` keeps its static redirect, and an inline, hash-allowed script honours `jf_lang` when present.
  - It never depends on location.

---

## I. Decisions needing maintainer approval

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Integrate the homepage polish (on `feat/phase-2-ux`, not `main`) | Authorise a PR `feat/phase-2-ux → main`; the Phase 3 base is `main` after it merges |
| D2 | Architecture | **A**: static export plus a same-origin Node API plus PostgreSQL; profiles built statically from a snapshot |
| D2-nav | Navigation | Njia · Maabara · Wajenzi · Rasilimali ▾ (Library, Glossary, Practice, Progress) plus language plus account |
| D3 | Hosting, domain and deploy pipeline | A host that runs the existing container, the API and managed Postgres, with secrets management and a deploy hook for publish-triggered rebuilds; the real domain replaces the `SITE_URL` placeholder |
| D4 | GitHub App ownership | Registered by the Bitsacco organisation, with no permissions, one callback URL and the revoke webhook; installed on the Bitsacco org for public-data sync |
| D5 | User-token storage | Don't store; identity only |
| D6 | Nostr scope | NIP-07 in 2b; NIP-46 (QR or bunker) in 2b if the spike passes, otherwise its own increment; NIP-55 (Android signer) later |
| D7 | GitHub users who haven't signed up | Not listed in Phase 3 |
| D8 | Images | Allow GitHub avatars on builder pages only; don't show Nostr pictures |
| D9 | Recovery | No email; strongly encourage linking both providers; last identity locked; deletion self-serve |
| D10 | Ecosystem list | Maintainers own `content/ecosystem.json` through PR review |
| D11 | API dependencies | `postgres`, `@noble/curves`, `@noble/hashes`, `zod`; `node:http` with no framework |
| D12 | Translation review | Name one reviewer each from Kenya and Tanzania |
| D13 | Retention | Security events 90 days; expired sessions and challenges purged daily |

### Risks

- **Profile freshness under architecture A** is a build away. It's mitigated by a publish-triggered rebuild; if the product needs instant pages, revisit B.
- **GitHub search limits.** The 1,000-result cap affects prolific contributors; this is disclosed in the UI and handled by the `incomplete` flag.
- **Installation-token search coverage** is unverified (spike 1a); the fallback is D5's encrypted user tokens.
- **Mobile Nostr** depends on signer adoption. Without NIP-46, mobile users without an extension can only use GitHub.
- **New operational surface:** secrets, backups and the database. Increment 6 delivers a runbook.
- **The header budget** has about 1.3 KB of headroom on lessons. The account control must stay static HTML, and the budget gate enforces it.
