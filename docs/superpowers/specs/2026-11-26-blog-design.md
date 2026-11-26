# Jifunze blog: design

Date: 2026-11-26. Status: draft for owner approval.

## Intent

Jifunze gets a blog, **Makala** in Kiswahili, written for Jifunze learners in Kiswahili, English or both. It is not a copy of bitsacco.com's blog and does not use Sanity.

The blog has its own job (owner's framing): **lessons answer "teach me this"; the blog answers "help me understand what's happening, why it matters, and what to explore next."** It is an editorial layer around the curriculum, the front door and ongoing conversation, not a fifth content format competing with the 49 lessons. Every post leads readers into the curriculum: blog → curiosity → lesson → practice.

Posts are content artifacts like lessons: version-controlled, reviewed through pull requests, validated by CI and built into the static site. Colleagues can post too, through the same reviewed workflow.

## Goals

- `/{lang}/blog/`: an index with category filter, a featured post and recent posts. The header label is **Makala** (sw) and **Blog** (en).
- `/{lang}/blog/{slug}/`: a post with its article, **Continue learning** (related lessons), related posts and the feedback link.
- A post may be written in Kiswahili, English or both (owner). Every post is listed on both language indexes; a post not available in the page language carries a language badge and opens in its own language with a one-line note, as lessons do for a missing translation. *(Listing behaviour: builder's call.)*
- Posts may include **labelled diagrams** (owner, option 2): an image with numbered markers that reveal a short explanation when tapped. Without JavaScript the explanations are a numbered list under the image.
- v1 launches with one post drawn from the community savings lessons, drafted by the builder and reviewed by the owner before merge (owner).
- Workflow: write → pull request → content validation and link checks in CI → owner review → merge → manual deploy.
- Same guarantees as lessons: strict CSP, no client-side content fetching, works without JavaScript, offline reading of visited posts, accessible, within the JavaScript budgets.

## Non-goals (v1)

- Sanity or any CMS, external content API, webhook or automatic publishing.
- Embedded third-party video players (YouTube iframes and the like).
- Comments, newsletter, search, analytics, RSS, pagination and scheduled publishing.
- Homepage changes. Builders and Lightning stay secondary and community finance stays primary (owner direction of 2026-11-25).

## Anti-goals (failure even if it technically works)

- Posts that duplicate a lesson instead of leading into one.
- Financial or investment advice, price calls or hype. The lesson rule in CONTRIBUTING applies to posts.
- A post published without the owner's review.
- Any outside request from the learner's browser, a weakened CSP, or broken offline and no-JavaScript reading.

## Approaches considered

| | Approach | Trade-off | Outcome |
| --- | --- | --- | --- |
| A | MDX files in the repo, built like lessons | Reuses the pipeline, review, validation, offline and CSP. Writers need GitHub (web editor is enough). | **Chosen by the owner** |
| B | Sanity, fetched at build time | Friendliest editor, but posts still need a rebuild and deploy (deploys are manual), builds depend on Sanity, and edits skip PR review and history | Rejected: loses review discipline for financial and Bitcoin education |
| C | A Git-based editor (Keystatic/Decap) over A | Friendlier screen, PR flow kept, but adds a GitHub login flow and admin page | Deferred: can be added on top of A later without moving content |
| — | Sanity fetched in the browser | Breaks CSP, offline and indexing | Ruled out |

## Content model

Shared metadata lives once, in a registry, so the two languages cannot disagree. The text lives in one MDX file per language. This mirrors roadmap JSON plus lesson files. *(Builder's call, recorded here.)*

```
content/blog/
  posts.json              # registry: one entry per post, newest first not required
  categories.json         # category ids with Kiswahili and English labels
  sw/<slug>.mdx           # Kiswahili version (title, excerpt, image alt, body), if written
  en/<slug>.mdx           # English version, if written
  _template/              # copy-and-fill template for writers; ignored by the build
public/images/blog/<slug>.<webp|jpg|png>   # optional featured image, self-hosted
```

`posts.json` entry:

| Field | Required | Notes |
| --- | --- | --- |
| `slug` | yes | Lowercase words joined by hyphens. When a post has both languages, they share the slug, so the language switch maps one-to-one, as lessons do. |
| `category` | yes | An id from `categories.json` |
| `author` | yes | Display name, as written |
| `publishedAt` | yes | `YYYY-MM-DD` |
| `updatedAt` | no | `YYYY-MM-DD`, not before `publishedAt` |
| `featured` | no | Boolean. The newest featured post leads the index. With none, the newest post does. |
| `image` | no | Site path under `/images/blog/`. Each language file then needs `imageAlt`. |
| `relatedLessons` | yes | 1–4 entries of `roadmap/slug`, each an existing lesson. Posts must not just end. |

MDX frontmatter (per language): `title`, `description` (the excerpt), `imageAlt` (when the post has an image) and `terms` (optional glossary ids, as in lessons).

`categories.json` starts with the owner's eight kinds of post:

| id | en | sw (for owner's Kiswahili review) |
| --- | --- | --- |
| `explainers` | Explainers | Maelezo |
| `guides` | Practical guides | Miongozo |
| `developments` | Current developments | Yanayojiri |
| `case-studies` | Case studies | Mifano halisi |
| `myths` | Myth-busting | Kweli au uongo |
| `community` | Community stories | Hadithi za jamii |
| `terms` | Glossary deep dives | Maneno kwa kina |
| `pathways` | Learning pathways | Njia za kujifunza |

The filter shows only categories that have at least one post. *(Builder's call.)*

Body MDX may use `Term`, `Callout`, tables, `Diagram` (the labelled diagram below), `Video` and `VideoLink` (videos below). `<Exercise>` is not allowed in posts: labs belong in lessons, and allowing it would widen the CSP. *(Builder's call.)*

## Labelled diagram

```mdx
<Diagram src="/images/blog/chama-treasury.webp" alt="A chama treasury: members, treasurer, keys and payout">
  <Marker x={22} y={30} title="Who holds the keys">Text…</Marker>
  <Marker x={70} y={55} title="If the treasurer leaves">Text…</Marker>
</Diagram>
```

- `x`/`y` are percentages of the image, so markers stay in place at any width.
- Markers are real buttons, numbered, keyboard-operable, with visible focus. Tapping one shows its explanation in a panel below the image, without covering it on phones; one panel is open at a time.
- Server-rendered: the image plus a numbered list of every explanation. A small client island upgrades the list into markers and the panel. With no JavaScript, or with reduced motion, nothing is lost.
- The image follows the same rules as featured images: self-hosted under `/images/blog/`, alt text required, 400 KB maximum. The validator checks marker coordinates are 0–100 and that each marker has a title and text.

## Launch post (builder's proposal, owner reviews the text)

- **Topic:** "What happens if your chama loses access to its wallet?" / "Nini kinatokea chama chenu kikipoteza ufikiaji wa pochi yake?", in category `guides`, in both languages.
- **Content:** it draws only on what the community savings lessons already teach: who holds the keys, signing rules, a treasurer leaving, backups and a recovery rehearsal. It adds no new financial claims.
- **Diagram:** one labelled chama-treasury diagram (members, treasurer, signers, backup, payout) to exercise the component.
- **Continue learning:** `savers/group-multisig`, `savers/group-treasury` and `savers/custody-recovery`.

## Videos (owner: self-hosted clips and links out)

**Short clips hosted on Jifunze**

```mdx
<Video src="/videos/blog/treasury-signing.mp4" poster="/images/blog/treasury-signing.webp"
       captions="/videos/blog/treasury-signing.sw.vtt" title="Jinsi saini mbili zinavyolinda hazina" />
```

- **Format:** MP4 (H.264/AAC), at most **2 minutes** and **10 MB**, stored under `public/videos/blog/`.
- **Required with every clip:**
  - a poster image (image rules: self-hosted, at most 400 KB);
  - WebVTT captions in the post's language;
  - a title.
- **Playback:** native browser controls, `preload="none"` so nothing but the poster downloads until the reader taps play, `playsinline`, no autoplay and no loop. It works without JavaScript.
- **Offline:** the service worker doesn't cache videos, just as it doesn't cache books. Offline, the reader sees the poster and a one-line note that the video needs a connection.
- **Security policy:** media from the site itself is already allowed by `default-src 'self'`, so no change is needed. nginx gets a `text/vtt` type for captions, because its built-in types have none.

**Links out to longer videos**

```mdx
<VideoLink href="https://www.youtube.com/watch?v=…" poster="/images/blog/talk.webp" title="…" duration="12:30" />
```

- A card with the self-hosted poster, the title, the duration and a play icon, plus a visible line saying where it opens (for example "Opens on YouTube", taken from the link's host).
- It's a plain link with no embed, so nothing from the video site loads unless the reader taps it. The link must pass the existing `checkUrl` rules (https).

## Writing a post (owner and colleagues)

1. Copy `content/blog/_template/` (a registry snippet and a language file) and fill it in, in Kiswahili, English or both. GitHub's web editor is enough; images upload through the browser.
2. Open a pull request. CI explains any problem in plain language: a missing alt text, an unknown related lesson, an image that is too large.
3. The owner reviews and merges; the post appears with the next manual deploy. The author's name is shown as written in the registry.

CONTRIBUTING gets a step-by-step "Writing a blog post" guide for the web editor. Fallback without GitHub: a colleague sends the owner a draft and the owner opens the pull request. A form-based editor (Keystatic/Decap) stays out of v1; it needs an outside GitHub login service.

## Validation (CI, `npm run validate`)

Errors:
- a registry entry with neither `sw/<slug>.mdx` nor `en/<slug>.mdx`, or an MDX file without a registry entry;
- a schema failure, a duplicate slug, an unknown category, an invalid or reversed date;
- a `relatedLessons` entry that doesn't exist;
- a missing image file, a missing `imageAlt`, or an image over 400 KB, to protect learners' mobile data;
- `<Exercise>` in a post;
- a `Diagram` without alt text, with a marker outside 0–100, or a marker without a title or text;
- a `Video` whose file is missing or isn't MP4, is over 10 MB or over 2 minutes (read from the MP4 header), or lacks a poster, captions starting with `WEBVTT`, or a title;
- a `VideoLink` without a valid https `href`, a poster or a title;
- an external link failing the existing `checkUrl` rules.

Internal links are covered by the existing post-build link check.

## Pages

```
/{lang}/blog/
  [Blog title + one-line lead]
  [All] [Explainers] [Practical guides] ...        ← chips; shown only when posts exist
  ┌──────────── featured post ────────────┐
  │ category · date · N min               │  [image]
  │ Title                                 │
  │ Excerpt                               │
  └───────────────────────────────────────┘
  Recent posts: cards (category · date · N min, title, excerpt)

/{lang}/blog/{slug}/
  Blog / Category
  Title, excerpt, author · published (updated) · N min
  [image with alt]
  Article body
  ── Continue learning ──  lesson cards: path · title · minutes
  ── Related posts ──      up to 3: same category first, then newest
  Feedback link (with post context)
```

- Layout follows the reference's structure (hero, chips, large featured card) in Jifunze's own visual language: night/teal hero and earth tones, as on the homepage.
- The category filter is a small client component, like the catalogue. Without JavaScript, all posts are listed. *(Builder's call.)*
- Reading time is words ÷ 200, rounded up, minimum 1. *(Builder's call.)*
- Dates are formatted per language from the build-time values, with no client clock.
- Metadata: page metadata with canonical and language alternates, `og:type=article` on posts, and blog routes in `sitePaths` (sitemap). Staging's noindex is unchanged.
- Offline: the existing service worker keeps visited posts, like lessons, and is extended to keep blog images (`/images/blog/`, each at most 400 KB) when a post is viewed, so diagrams and posters work offline. Videos are never cached. Nothing is precached.
- Navigation: a **Makala / Blog** item in the header and a footer link under Resources. The header must still pass the 360 px width tests.

## Testing

- **Unit:** registry and frontmatter schemas, every validator error above (with fixtures), the loader (both languages, related lessons resolved), reading time, and featured/recent ordering.
- **E2E (both languages):** the index renders and the filter works; a one-language post is listed on both indexes with its badge and opens in its own language with the note; diagram markers open and close by tap and keyboard, and without JavaScript all explanations are listed; without JavaScript every post is listed; a post shows its related lessons, each linking to the real lesson; the language switch keeps the slug; axe has no serious or critical violations; no outside requests; the header stays within 360 px; and visited posts work offline.
- **Budgets:** blog pages within the existing UX/JS budgets (add a route entry if needed).

## Documentation

- CONTRIBUTING: a "Blog posts" section covering files, fields, both languages, review, and no advice or price calls.
- Content guide: the editorial role of the blog versus lessons.
- README: one line under the library or learning paths.

The curriculum licence (`content/LICENSE`, CC BY-SA 4.0) already covers `content/blog/`.

## Owner decisions (2026-11-26)

- Approach A; no Sanity.
- Kiswahili name: Makala.
- Launch with one post drawn from the community savings lessons.
- Interactive images: labelled diagrams (option 2).
- Videos: short self-hosted clips and links out to longer videos (options 1 and 2); no embedded players.
- A post may be in either language or both.
- Colleagues post through the same pull-request workflow.

## Left to the builder

Component structure; exact card styling within the existing design tokens; the copy keys and their placement (`lib/i18n.ts` versus `lib/site-copy.ts`); and the fixture content for tests.
