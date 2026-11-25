# Batch 1: Homepage repositioning around community finance

Status: approved by the project owner on 2026-11-25.

## Intent

Jifunze should read as the place to check before engaging in community finance (chamas, SACCOs, personal savings, savings tools), with Bitcoin presented as the way to strengthen them. The curriculum for this already exists in the Savers path (24 lessons with individual, community and cooperative specializations). The homepage and path pages still say "Learn Bitcoin for free… Choose your path", so the positioning, not the curriculum, is what Batch 1 changes.

Batch 1 is built and verified locally, then pushed to staging for review only after owner approval.

## Goals

- Hero copy leads with community finance.
- Community Finance & Bitcoin is visibly the primary path; Builders and Lightning are secondary, framed as building tools for communities.
- Four "Where are you starting?" entry points route learners to existing lessons.
- Glossary search is reachable from the homepage.
- Learners are told their progress stays in their browser.
- Honest, build-time content counts (no learner metrics).
- Path pages explain What you'll learn / How it works / Who it's for.
- The 404 page links to every main destination.

## Non-goals

- No lesson content changes, no new lessons.
- No Evaluate/Reviews section (Batch 3).
- No route, roadmap id, lesson slug or progress-key changes.
- No change to the baobab artwork beyond its label text.
- No analytics or tracking.
- README screenshots are refreshed only after the batch is accepted.

## Anti-goals

- Increasing homepage gzip JavaScript (budget 144.9 KB in `lib/build/ux-budget.ts`).
- Moving the primary actions below the first screen (`e2e/home.spec.ts` "the main actions are on the first screen").
- Any metric that is not computed from repository content.
- Kiswahili copy reaching staging without owner review.

## Approaches considered

| | Approach | Outcome |
|---|---|---|
| A | Copy-only change, three equal path cards | Rejected: Community Finance does not read as primary |
| **B** | **Full-width lead Community Finance card; Builders and Lightning as two smaller cards under "Build the tools communities need"** | **Chosen**: keeps the three-branch baobab, the lab path and the three-card structure |
| C | Merge Builders and Lightning into one card | Rejected: breaks the three-branch baobab and hides the lab path |

## Design

### Homepage order

1. Baobab scene (unchanged artwork).
2. Hero: title "Check before you save" / "Kagua kabla ya kuweka akiba"; subtitle "Chamas, SACCOs, personal savings and Bitcoin" / "Chama, SACCO, akiba binafsi na Bitcoin"; lead "Learn how savings groups and money tools really work, what the real risks are, and how Bitcoin can make them stronger. Free, no sign-up." (Kiswahili drafted for owner review).
3. Existing actions: Start learning, Browse all lessons.
4. Content counts line: lessons, languages, total reading hours, glossary terms, computed at build time.
5. Continue card (when progress exists) with "Saved only in this browser" and a link to the progress page.
6. "Where are you starting?" / "Unaanzia wapi?" with four links:
   - About to join a group → `/{lang}/savers/saving-together/`
   - Already in a chama or SACCO → `/{lang}/savers/#specializations`
   - Want to save on my own → `/{lang}/savers/money-and-bitcoin/`
   - Want to move my group to Bitcoin → `/{lang}/savers/group-payments/`
7. Numbered path cards: `01` Community Finance & Bitcoin full width with an outcome line; heading "Build the tools communities need", then `02` Builders and `03` Lightning as smaller cards.
8. Lightning lab panel, How Jifunze works, Library and Glossary cards (unchanged), plus glossary term links (see below).

### Path rename

Savers roadmap title becomes "Community Finance & Bitcoin" / "Fedha za Jamii na Bitcoin"; branch label becomes "Community" / "Jamii"; tagline and description rewritten. Id `savers` and all slugs stay.

### Path pages

Optional bilingual roadmap fields `outcomes` (3–5 items), `format`, `audience`, validated by the content schema, rendered as What you'll learn / How it works / Who it's for. Written for all three paths.

### Glossary from the homepage

Revised during planning (pending owner confirmation): the site CSP sets `form-action 'none'` (`lib/build/csp.ts`), so a homepage `GET` form cannot submit, and loosening that directive is out of scope. Instead the Glossary card area shows four community-finance term links (`chama`, `rosca`, `quorum`, `self-custody`), each to `/{lang}/glossary/#<id>` (rows already carry ids and a `:target` highlight), plus "Search all N terms" linking to `/{lang}/glossary/`. No new JavaScript, no form, no CSP change.

### 404

Stays bilingual; adds links to the three paths, all lessons, glossary and library in both languages.

### Also updated

`public/manifest.webmanifest` description and the README path description.

## Constraints

- New user-facing strings go in `lib/site-copy.ts` or are passed as props from server components; `lib/i18n.ts` is bundled into every page.
- Every string exists in Kiswahili and English.
- Static export; no backend.

## Verification

`npm run check`, `npm run build`, `npm run check:ux-budget`, `npm run e2e` (including axe accessibility). New tests cover the entry points, counts, glossary term links, 404 links, path-page sections and card order. Homepage JS must not exceed its current size.

## Left to the builder

Exact Tailwind classes, card sizing at each breakpoint, and the precise Kiswahili wording (owner reviews before staging).
