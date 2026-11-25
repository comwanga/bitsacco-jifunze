# Homepage redesign: savings circle, starting points, questions and world map

Status: owner decisions recorded 2026-11-25; awaiting approval of the full design. Builds on Batch 1 (`2026-11-25-homepage-repositioning-design.md`), which is implemented on `feat/community-finance-homepage`.

## Intent

The homepage should feel alive and polished, in the spirit of myfirstbitcoin.org's interactive homepage, while staying unmistakably Jifunze. It speaks to people deciding whether and how to save in a chama, SACCO or savings group, with Bitcoin as the way to strengthen it. Builders and Lightning are optional side paths and get no homepage space (owner direction, 2026-11-25). The baobab hero is retired.

## Goals

- A hero with "Check before you save" and an animated savings circle (Learn how it works → Check the group → Save together → Teach your chama).
- "Where are you starting?" tiles directly under the hero, back at the top as first approved in Batch 1.
- One Community Finance & Bitcoin path card with its three specializations.
- "Three questions before you join" as slanted cards that link to the lessons answering them.
- "Savings groups around the world": a dot-pattern world map with real local names.
- Bitsacco's own visual identity: teal `#008080` and sun orange (`#ff5800`, `#c94400` for text-bearing fills), night `#1b2550`, cream and sand neutrals, one repeated slant motif.

## Non-goals

- No Evaluate/checklist pages (the question cards link to existing lessons for now).
- No blog, Sanity, trust band or article strip (owner left these off the homepage).
- No change to lesson pages, path pages, header or footer, except removing homepage-only code.
- No new routes.

## Anti-goals

- Homepage gzip JS above 144.9 KB (`UX_LIMITS.home`); the redesign should reduce it (baobab, intro script and lab strings are removed).
- Any looping animation that runs longer than 5 seconds without a pause control (WCAG 2.2.2).
- Any number on the page not computed from repository content.
- Copying My First Bitcoin's identity (purple palette, exact slant geometry, wording).
- Map data or images loaded from a third-party service at runtime.

## Approaches

**Hero** (chosen by the owner from three browser mockups):

| | Option | Outcome |
|---|---|---|
| A | The four starting tiles are the hero | Not chosen |
| **B** | **Savings circle: animated cycle, tiles below** | **Chosen** |
| C | Three question cards as the hero | Not chosen; the questions become section 4 instead |

**Sections below the hero** (owner picked from six optional sections): kept 4 (three questions) and 5 (world map). Dropped trust band, latest articles, library/glossary cards and the builders row.

**World map source** (owner choice):

| | Option | Outcome |
|---|---|---|
| **A** | **Dot-pattern map generated once from Natural Earth 1:110m land (public domain)** | **Chosen** |
| B | Name cards only, no map | Not chosen |
| C | Ready-made Wikimedia image | Not chosen (per-file licence checks, fixed look) |

**Animation technique** (my call): a single inline SVG animated with CSS keyframes. A JS animation library is ruled out by the 0.4 KB JS headroom; canvas is ruled out by accessibility and no-JS rendering.

## Design

### Page order (top to bottom)

1. **Hero** (dark night/teal gradient, slanted bottom edge into cream):
   - h1 `Check before you save` with an orange hand-drawn-style underline on "save" (CSS background gradient, no image).
   - Subtitle and lead from Batch 1 `siteCopy` (`heroSubtitle`, `heroLead`).
   - The savings circle (see below), beside the text from `md`, below it on phones.
   - Actions: primary `Where are you starting?` linking to `#anza`; secondary `heroBrowse` to `/{lang}/learn/`.
   - The Batch 1 counts line (`[data-stats]`).
2. **Where are you starting?** `<section id="anza">` with the Batch 1 `[data-start]` nav (same four links and order) and, for returning learners, the Batch 1 continue card (`[data-continue]`) above the tiles.
3. **01 Community Finance & Bitcoin**: the Batch 1 lead `PathCard` (`variant="lead"`, `number={1}`, outcome line). Add the three optional specializations as chips linking to `/{lang}/savers/#tree-section-<section id>` (anchors rendered by `PathTree` on the default tree view).
4. **Three questions before you join** (slanted cards, colour progression night → teal → sun):
   - `01 Who holds the money?` → `/{lang}/savers/custody-and-fedimint/`
   - `02 Can I leave with my share?` → `/{lang}/savers/cooperative-foundations/`
   - `03 What does it really cost?` → `/{lang}/savers/payments-liquidity/`
   Each card is one link; the card shows the question and "Read the lesson".
5. **Savings groups around the world**: lead line, the dot map with six markers, and a list of six `<details>` entries (name, place; opening shows one line).
6. Footer (unchanged).

### The savings circle

- One inline `<svg>` (`viewBox` square) with an outer track, four arc segments, a centre disc labelled `Your savings` / `Akiba yako`, and an orange dot that travels the track. The four steps are also an ordered list (`<ol data-circle-steps>`) next to or under the SVG, so the content is text, not only graphics; the SVG is `aria-hidden`.
- **Motion (owner decision 2):** the dot makes one lap and each step highlights in turn, finishing in **4.8 s**, then rests with all steps shown and step 4 highlighted. Running under 5 seconds with no loop meets WCAG 2.2.2 without a pause control. Under `prefers-reduced-motion: reduce` there is no animation and all steps show at once.
- CSS lives in a component stylesheet imported by the server component; no client component.

### Removed

- `components/intro/` (BaobabScene, baobab.css, IntroReplay), `lib/intro/` (`introScript`, `shouldPlay`) and their tests.
- The homepage use of `HowItWorks` (four-step loop, library/glossary cards, Batch 1 glossary term links) and the Lightning lab panel. Delete `HowItWorks.tsx`, `HomeIcons.tsx` and `home.css` if nothing else imports them.
- Builders and Lightning `PathCard`s and the `Build the tools communities need` heading from the homepage.
- `lib/i18n.ts` keys used only by removed code (for example `sceneLabel`, `labsTitle`, `labsBody`, `labsCta`, `loop*`, `pathsTitle` if unused); `siteCopy` keys used only by removed code (`buildTitle`, `glossaryTermsLabel`, `glossarySearchAll`, `resourcesTitle`, `glossaryCard`, `libraryAction`, `glossaryAction`, `libraryCount`, `glossaryCount` if unused). The footer keeps its own keys.
- The Batch 1 ruling that placed start links after the lead card is reversed.

### World map

- **Data:** Natural Earth 1:110m land (public domain). Download once with owner approval into a fresh temporary directory outside the repo; do not commit the raw data. Record the source URL, version and SHA-256 in the script header and in `ATTRIBUTIONS.md`.
- **Generator:** `scripts/build-world-dots.ts` (run by hand, not in `npm run build`) samples a regular lattice in an equirectangular projection, keeps points on land, and writes `public/images/world-dots.svg` (committed; target ≤ 40 KB raw). Dots only; no country borders.
- **Markers:** the component renders the base map as `<img alt="">` with an inline overlay `<svg>` using the same `viewBox`; the projection function is shared with the generator (`lib/map/project.ts`, `project(lat, lon) → {x, y}`).
- **Content:** `content/world-groups.json`, validated by a zod `WorldGroupsSchema` in `lib/content/schemas.ts`: `{ id, name, place: {sw,en}, line: {sw,en}, lat, lon }[]`, exactly six entries:

| id | name | place (en / sw) | marker |
|---|---|---|---|
| chama | chama | Kenya / Kenya | −1.29, 36.82 |
| upatu | upatu | Tanzania / Tanzania | −6.79, 39.21 |
| susu | susu | Ghana / Ghana | 5.60, −0.19 |
| arisan | arisan | Indonesia / Indonesia | −6.21, 106.85 |
| pandero | pandero | Peru / Peru | −12.05, −77.04 |
| stokvel | stokvel | South Africa / Afrika Kusini | −26.20, 28.05 |

  Revised during implementation: `tanda` (Mexico) replaced by `upatu` (Tanzania) because no readable source could be verified for tanda; FAO lists upatu (Tanzania) as a ROSCA. Each entry's `source` is the document that supports it (CBK FinAccess 2019, FAO group savings resource book, World Bank WPS6025, Cliffe Dekker Hofmeyr stokvel guide).

  `line`: one cautious sentence each, describing it only as a local name for group savings (rotating and/or accumulating), sourced from the references already cited by the `savings-groups` lesson (World Bank WPS6025, FAO, CARE). Under the list, the caveat from that lesson: `Names do not mean identical rules or legal status.` / `Majina hayamaanishi sheria au hali ya kisheria iliyo sawa.`
- **Offline:** add `/images/world-dots.svg` to `PRECACHE` and `cacheableStatic` in `public/sw.js`.

### Copy (en / sw draft; owner reviews sw)

| key | en | sw |
|---|---|---|
| circleCentre | Your savings | Akiba yako |
| circleLearn | Learn how it works | Jifunze jinsi inavyofanya kazi |
| circleCheck | Check the group | Kagua kikundi |
| circleSave | Save together | Wekeni akiba pamoja |
| circleTeach | Teach your chama | Fundisha chama chako |
| heroStartCta | Where are you starting? | Unaanzia wapi? |
| questionsTitle | Three questions before you join | Maswali matatu kabla ya kujiunga |
| questionHolds | Who holds the money? | Nani anashika pesa? |
| questionLeave | Can I leave with my share? | Naweza kuondoka na sehemu yangu? |
| questionCost | What does it really cost? | Gharama halisi ni kiasi gani? |
| questionRead | Read the lesson | Soma somo |
| worldTitle | Savings groups around the world | Vikundi vya akiba duniani |
| worldLead | Same idea, many names. The lessons apply wherever people save together. | Wazo moja, majina mengi. Masomo haya yanafaa popote watu wanapoweka akiba pamoja. |
| worldCaveat | Names do not mean identical rules or legal status. | Majina hayamaanishi sheria au hali ya kisheria iliyo sawa. |

All new keys go in `lib/site-copy.ts`.

## Constraints

- Static export, CSP unchanged (`form-action 'none'`; images self-hosted), no backend, works offline after first visit.
- Kiswahili-first; every string in both languages.
- Roadmap ids, slugs, URLs and progress keys unchanged.
- `prefers-reduced-motion` and `prefers-color-scheme` respected; WCAG 2.1 AA (axe suite) and 2.2.2.
- No horizontal scroll at 320px.

## Verification

- `npm run check`, `npm run build`, `npm run check:ux-budget` (home ≤ 144.9 KB and expected to fall), full `npm run e2e`.
- Rewrite `e2e/home.spec.ts` for the new layout. New tests: hero heading and circle steps; reduced motion has no running animation; start tiles in `#anza` before the path card; exactly one `[data-path-card]` on the homepage and no Builders/Lightning card (Builders stays reachable through the catalogue `/learn/`; Lightning through the header and footer); three question links; six world entries, map image returns 200 and is in the service-worker cache after install; 320px no horizontal scroll in both languages; axe on `/sw/` and `/en/` in light and dark.
- Phone first-screen rule: first start tile within the first screen on Pixel 5 (owner decision 1).

## Owner decisions (2026-11-25)

1. **Phone first-screen rule:** moves from the first path card to the start tiles. The first `[data-start]` tile must be within the first screen on Pixel 5 (mobile project). The old "first path heading within 1.2 screens" test is replaced, not relaxed silently.
2. **Circle motion:** one lap in 4.8 s, each step highlighted in turn, then rest with step 4 highlighted. No loop and no pause control. `prefers-reduced-motion: reduce` shows all steps without animation.
3. **Header "Lightning lab":** unchanged in this redesign. Header and footer stay as they are; only the homepage drops Builders and Lightning.

## Left to the builder

Exact spacing, slant angle, breakpoints, SVG geometry, lattice spacing and dot radius, and Tailwind classes, within the constraints above.
