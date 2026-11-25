# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the baobab homepage with a savings-circle hero, top-of-page starting tiles, a single Community Finance path card, three questions before joining and a dot-pattern world map of savings-group names.

**Architecture:** Server components only on the homepage (plus the existing client `ContinueLearning`). The circle is one inline SVG animated by CSS keyframes. World-group names live in a validated content JSON. The map is a committed static SVG produced once by a hand-run generator from Natural Earth data, with markers drawn in an inline overlay sharing a projection module.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, Tailwind 4, zod 4, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-25-homepage-redesign-design.md`

## Global Constraints

- Work on `feat/community-finance-homepage`; commit only with owner authorization; never push, open a PR or deploy without separate authorization. No `Co-Authored-By` trailer.
- Homepage gzip JS ≤ 144.51 KB (Batch 1 result) and ≤ `UX_LIMITS.home` 144.9 KB; `lib/i18n.ts` gains no keys.
- New strings go in `lib/site-copy.ts`, both `en` and `sw`, exact text from the spec's Copy table.
- No form elements; CSP unchanged; all images self-hosted; homepage works offline after first visit.
- Circle animation: one run, total 4.8 s, no loop, no pause control; `prefers-reduced-motion: reduce` → no animation, all steps shown.
- Header and footer unchanged. Roadmap ids, slugs, URLs and progress keys unchanged.
- No horizontal scroll at 320px; axe (wcag2a/aa, 21a/aa) clean in light and dark.
- Downloading Natural Earth data requires the owner's explicit yes at that step (Task 5), into a fresh directory outside the repo; the raw data is never committed.

## Review Focus

1. **Returning learner on a phone:** with saved progress the continue card sits above the tiles; its Continue link must be on the first screen, and for new learners the first start tile (Task 1 test pins both).
2. **Animation end state:** after the run, step 4 stays highlighted and nothing is still running (no `Infinity` iterations); a reload replays once (Task 1 test).
3. **Map marker drift:** a marker computed by `project()` must land on land in the generated map; a projection change without regenerating the SVG must fail a test (Task 5 test checks each marker's nearest dot distance).
4. **Map offline:** after the service worker installs, `/images/world-dots.svg` is served from cache with the network off (Task 5 test).
5. **Dead references:** nothing in `app/`, `components/`, `lib/` or tests still imports `components/intro`, `lib/intro`, `HowItWorks` or uses removed string keys (Task 2 grep step + typecheck).

---

### Task 1: Savings-circle hero and starting tiles at the top

**Files:**
- Create: `components/home/SavingsCircle.tsx`, `components/home/savings-circle.css`
- Modify: `app/[lang]/page.tsx` (hero, `#anza` section), `lib/site-copy.ts`
- Delete: `components/intro/` (BaobabScene.tsx, baobab.css, IntroReplay.tsx), `lib/intro/shouldPlay.ts`, `tests/intro/shouldPlay.test.ts`
- Modify tests: `e2e/home.spec.ts`, `e2e/header.spec.ts:54-60`, `e2e/learning-ux.spec.ts` (delete the five intro tests at lines 18, 26, 59, 72, 86), `e2e/smoke.spec.ts:26-31` (delete "with reduced motion the intro never plays"), `e2e/a11y.spec.ts:9` comment

**Interfaces:**
- Produces: `SavingsCircle({ lang }: { lang: Lang })` server component; root `<div data-circle>`; `<ol data-circle-steps>` with four `<li data-step="1..4">`; SVG `aria-hidden="true"`.
- Produces: homepage `<section id="anza">` containing `[data-continue]` (when progress exists) then `<nav data-start>` (Batch 1 links, same order).
- Produces: `siteCopy` keys `circleCentre`, `circleLearn`, `circleCheck`, `circleSave`, `circleTeach`, `heroStartCta` (values in spec Copy table).

- [ ] **Step 1: Write the failing e2e tests** (replace in `e2e/home.spec.ts` the tests "three paths: three cards and three baobab branches", "on a phone the first path is close to the top", "the main actions are on the first screen"; add the rest)

```ts
test("the hero shows the savings circle steps in order", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check before you save");
  await expect(page.locator("[data-circle-steps] li")).toHaveText(["Learn how it works", "Check the group", "Save together", "Teach your chama"]);
  await page.goto("/sw/");
  await expect(page.locator("[data-circle-steps] li").first()).toHaveText("Jifunze jinsi inavyofanya kazi");
});

test("the circle runs once and rests on step 4", async ({ page }) => {
  await page.goto("/en/");
  await page.waitForTimeout(5500);
  const state = await page.locator("[data-circle]").evaluate((el) =>
    el.getAnimations({ subtree: true }).map((a) => ({ state: a.playState, iterations: a.effect?.getTiming().iterations })));
  expect(state.length).toBeGreaterThan(0);
  expect(state.every((s) => s.state === "finished" && s.iterations !== Infinity)).toBe(true);
  await expect(page.locator('[data-circle-steps] li[data-step="4"]')).toHaveCSS("background-color", "rgb(201, 68, 0)");
});

test("reduced motion shows every step without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  expect(await page.locator("[data-circle]").evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator("[data-circle-steps] li")).toHaveCount(4);
});

for (const withProgress of [false, true])
  test(`on a phone the main way in is on the first screen (${withProgress ? "returning" : "new"} learner)`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "phone layout only");
    if (withProgress) await page.addInitScript(() => localStorage.setItem("jifunze:progress:v1", JSON.stringify({ app: "bitsacco-jifunze", version: 1, lessons: { "savers/money-and-bitcoin": { completedAt: "2026-11-01T10:00:00.000Z" } } })));
    await page.goto("/sw/");
    // New learners: the first starting tile. Returning learners: the Continue link, which sits above the tiles.
    const target = withProgress ? page.locator("[data-continue] a").first() : page.locator("[data-start] a").first();
    const box = (await target.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });

test("the hero action jumps to the starting tiles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  await page.getByRole("link", { name: "Where are you starting?" }).click();
  await expect(page).toHaveURL(/#anza$/);
  await expect(page.locator("#anza [data-start] a")).toHaveCount(4);
});
```
In `e2e/header.spec.ts` rename the jump test to "jumping to the starting tiles leaves their heading below the header": click `Where are you starting?`, expect `#anza`, and measure `#start-title` instead of the first path heading.

- [ ] **Step 2: Build and run to verify failure**

Run: `npm run build && npx playwright test e2e/home.spec.ts e2e/header.spec.ts`
Expected: the new tests FAIL (no `[data-circle]`, no `#anza`).

- [ ] **Step 3: Implement**

`SavingsCircle`: square SVG (outer track, four arc segments, centre disc with `circleCentre`, orange dot) and the `<ol>`. CSS in `savings-circle.css`, imported by the component:
- one `@keyframes` for the dot lap (`4.8s`, `1` iteration, `forwards`);
- per-step highlight keyframes with delays 0, 1.2, 2.4, 3.6 s, each `1.2s`, `forwards` only on step 4 so it ends highlighted with background `#c94400` and white text;
- `@media (prefers-reduced-motion: reduce)` sets `animation: none` on all of them.

Page: remove `IntroReplay`, `BaobabScene`, the intro `<script>`; hero = h1 (orange underline span on the last word, both languages), subtitle, lead, `SavingsCircle`, actions (`heroStartCta` → `#anza`, `heroBrowse` → `/{lang}/learn/`), `[data-stats]`. Directly after the hero: `<section id="anza" aria-labelledby="start-title">` with `ContinueLearning` then the Batch 1 start nav. Hero background: night→teal gradient with a slanted bottom edge (`clip-path`). Delete the intro files and their tests listed above.

- [ ] **Step 4: Verify**

Run: `npm run check && npm run build && npx playwright test e2e/home.spec.ts e2e/header.spec.ts e2e/smoke.spec.ts e2e/learning-ux.spec.ts e2e/a11y.spec.ts && npm run check:ux-budget`
Expected: PASS; `UX home` ≤ 144.51 KB.

- [ ] **Step 5: Commit**

```bash
git add -A app/[lang]/page.tsx components/home/SavingsCircle.tsx components/home/savings-circle.css components/intro lib/intro tests/intro lib/site-copy.ts e2e
git commit -m "feat(home): replace the baobab with the savings circle and put the starting tiles first"
```

---

### Task 2: One path card, specialization chips, and removing the lower homepage

**Files:**
- Modify: `app/[lang]/page.tsx`, `components/home/PathCard.tsx`, `lib/site-copy.ts`, `lib/i18n.ts`
- Delete: `components/home/HowItWorks.tsx`, `components/home/HomeIcons.tsx`, `components/home/home.css` (after confirming no other importer)
- Modify tests: `e2e/home.spec.ts` (remove "how it works is a four-step journey", "library and glossary are cards with a clear action", "community finance leads, builders follow…", the glossary term-link tests; add below)

**Interfaces:**
- Consumes: `pathOrder(roadmap).optionalSections`, roadmap `sections` (`optional`, `id`, `title`).
- Produces: `PathCard({ roadmap, lessons, lang, number, outcome, specializations })` where `specializations: { id: string; title: string }[]` renders `<ul data-specializations>` of links to `/${lang}/${roadmap.id}/#tree-section-${id}`, labelled by `t(lang, "chooseSpecialization")`. The `variant` prop and compact branch are removed.

- [ ] **Step 1: Write the failing tests**

```ts
test("the homepage has one path card with its three specializations", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("[data-path-card]")).toHaveCount(1);
  await expect(page.locator("[data-path-card]")).toHaveAttribute("data-path-card", "savers");
  const chips = page.locator("[data-specializations] a");
  await expect(chips).toHaveCount(3);
  const hrefs = await chips.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual(["individual-savings", "community-savings", "cooperative-finance"].map((id) => `/en/savers/#tree-section-${id}`));
  await chips.nth(1).click();
  await expect(page.locator("#tree-section-community-savings")).toBeInViewport();
});

test("builders, lightning, the lab panel and resource cards are not on the homepage", async ({ page }) => {
  await page.goto("/en/");
  const main = page.locator("main");
  await expect(main.locator('a[href="/en/builders/"], a[href="/en/lightning/"]')).toHaveCount(0);
  await expect(main.locator("#labs-title, [data-loop], [data-resource], [data-glossary-terms]")).toHaveCount(0);
  expect(await page.locator('header a[href="/en/lightning/"]').count()).toBeGreaterThan(0); // header unchanged (owner decision 3)
});
```

- [ ] **Step 2: Build and run to verify failure**

Run: `npm run build && npx playwright test e2e/home.spec.ts -g "one path card|not on the homepage"`
Expected: FAIL (three cards today; lab panel present).

- [ ] **Step 3: Implement**

Page renders only the savers `PathCard` (`number={1}`, `outcome={c.leadOutcome}`, `specializations` from the roadmap's optional sections) after `#anza`. Remove the build heading, tool cards, lab section, `HowItWorks`, `FEATURED_TERMS`, and the `getGlossary`/`getLibrary` imports if unused. Delete the three component files. Remove now-unused keys: `lib/i18n.ts` — `sceneLabel`, `labsTitle`, `labsBody`, `labsCta`, `loopTitle`, `loop1Title`…`loop4Body`, `pathsTitle`, `startLearning`, `openPath` only if `PathCard` no longer uses it; `lib/site-copy.ts` — `buildTitle`, `glossaryTermsLabel`, `glossarySearchAll`, `resourcesTitle`, `glossaryCard`, `libraryAction`, `glossaryAction`, `libraryCount`, `glossaryCount`.

- [ ] **Step 4: Verify no dead references**

Run: `grep -rnE "components/intro|lib/intro|HowItWorks|HomeIcons|home\.css|labsTitle|loop[1-4]|sceneLabel|glossaryTermsLabel|buildTitle" app components lib tests e2e` → no output.
Run: `npm run check && npm run build && npx playwright test e2e/home.spec.ts e2e/a11y.spec.ts && npm run check:ux-budget`
Expected: PASS; `UX home` ≤ Task 1 value.

- [ ] **Step 5: Commit**

```bash
git add -A app/[lang]/page.tsx components/home lib/site-copy.ts lib/i18n.ts e2e/home.spec.ts
git commit -m "feat(home): keep one community finance path and drop the lower homepage sections"
```

---

### Task 3: Three questions before you join

**Files:**
- Create: `components/home/JoinQuestions.tsx`
- Modify: `app/[lang]/page.tsx`, `lib/site-copy.ts`
- Test: `e2e/home.spec.ts`

**Interfaces:**
- Produces: `JoinQuestions({ lang }: { lang: Lang })`, root `<section data-questions aria-labelledby="questions-title">`, three `<a data-question="holds|leave|cost">`.
- Produces: `siteCopy` keys `questionsTitle`, `questionHolds`, `questionLeave`, `questionCost`, `questionRead` (spec Copy table).

- [ ] **Step 1: Write the failing test**

```ts
for (const lang of ["en", "sw"] as const)
  test(`${lang}: three questions link to the lessons that answer them`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    const cards = page.locator("[data-questions] a");
    await expect(cards).toHaveCount(3);
    const hrefs = await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(["custody-and-fedimint", "cooperative-foundations", "payments-liquidity"].map((s) => `/${lang}/savers/${s}/`));
    if (lang === "en") await expect(cards.first()).toContainText("Who holds the money?");
  });
```

- [ ] **Step 2: Build and run to verify failure** — `npm run build && npx playwright test e2e/home.spec.ts -g "three questions"`; Expected: FAIL.

- [ ] **Step 3: Implement** after the path card: h2 `questionsTitle`; three slanted cards (`skewX` on the card, counter-skew on the content) numbered `01`–`03`, fills night → teal-700 → `#c94400` with white text; each card is a single link with the question and `questionRead`. Stack vertically below `sm`.

- [ ] **Step 4: Verify** — `npm run build && npx playwright test e2e/home.spec.ts e2e/a11y.spec.ts && npm run check:ux-budget`; Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/home/JoinQuestions.tsx app/[lang]/page.tsx lib/site-copy.ts e2e/home.spec.ts
git commit -m "feat(home): add three questions to ask before joining a savings group"
```

---

### Task 4: Savings groups around the world (content and list)

**Files:**
- Create: `content/world-groups.json`, `components/home/WorldGroups.tsx`
- Modify: `lib/content/schemas.ts`, `lib/content/load.ts`, `app/[lang]/page.tsx`, `lib/site-copy.ts`
- Test: `tests/content/world-groups.test.ts`, `e2e/home.spec.ts`

**Interfaces:**
- Produces: `WorldGroupsSchema` (array of `{ id: slug, name: string, place: Localized, line: Localized, lat: number(-90..90), lon: number(-180..180), source: string(url) }`, length exactly 6, unique ids) and `type WorldGroup`.
- Produces: `getWorldGroups(root?: string): WorldGroup[]` in `lib/content/load.ts`.
- Produces: `WorldGroups({ lang, groups, map? }: { lang: Lang; groups: WorldGroup[]; map?: ReactNode })`; root `<section data-world aria-labelledby="world-title">`; `<ul data-world-list>` of six `<li><details>` (summary: name + place; body: line); caveat paragraph. `map` is filled in Task 5.
- Produces: `siteCopy` keys `worldTitle`, `worldLead`, `worldCaveat` (spec Copy table).

- [ ] **Step 1: Write the failing unit tests** (`tests/content/world-groups.test.ts`)

```ts
import { expect, test } from "vitest";
import { WorldGroupsSchema } from "../../lib/content/schemas.ts";
import { getWorldGroups } from "../../lib/content/load.ts";

test("six named groups in the spec's order with both languages", () => {
  const g = getWorldGroups();
  expect(g.map((x) => x.id)).toEqual(["chama", "tanda", "susu", "arisan", "pandero", "stokvel"]);
  for (const x of g) expect(x.line.sw && x.line.en && x.place.sw && x.place.en).toBeTruthy();
});
test("coordinates outside the globe are rejected", () => {
  const g = getWorldGroups();
  expect(WorldGroupsSchema.safeParse([{ ...g[0], lat: 91 }, ...g.slice(1)]).success).toBe(false);
});
test("duplicate ids are rejected", () => {
  const g = getWorldGroups();
  expect(WorldGroupsSchema.safeParse([g[0], g[0], ...g.slice(2)]).success).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/content/world-groups.test.ts`; Expected: FAIL (export missing).

- [ ] **Step 3: Implement schema, loader and content.** Coordinates and places from the spec table. `line` text (draft; each must be supported by the cited `source`; if a source does not support a line, shorten it to "A name used in <place> for group savings." and record a ledger ruling):

| id | en | sw | source |
|---|---|---|---|
| chama | A Kenyan name for a savings group. Some rotate payouts, some build a shared fund, some invest together. | Jina la Kenya la kikundi cha akiba. Vingine huzungusha malipo, vingine hujenga mfuko wa pamoja, vingine huwekeza pamoja. | World Bank WPS6025 |
| tanda | A name used in Mexico for a rotating savings group: each round, one member receives the pot. | Jina linalotumika Meksiko kwa kikundi cha akiba cha mzunguko: kila awamu, mwanachama mmoja hupokea mfuko. | World Bank WPS6025 |
| susu | A name used in Ghana and parts of the Caribbean for group savings, including rotating groups. | Jina linalotumika Ghana na sehemu za Karibiani kwa akiba ya kikundi, ikiwemo vikundi vya mzunguko. | World Bank WPS6025 |
| arisan | An Indonesian rotating savings gathering, often held at regular meetings. | Mkusanyiko wa akiba wa mzunguko nchini Indonesia, mara nyingi hufanyika kwenye mikutano ya kawaida. | World Bank WPS6025 |
| pandero | A name used in Peru for a rotating savings group. | Jina linalotumika Peru kwa kikundi cha akiba cha mzunguko. | World Bank WPS6025 |
| stokvel | A South African name for savings clubs, which may rotate payouts or build a shared fund. | Jina la Afrika Kusini la vilabu vya akiba, ambavyo vinaweza kuzungusha malipo au kujenga mfuko wa pamoja. | World Bank WPS6025 |

`source` URL: `https://documents1.worldbank.org/curated/en/453121468331738740/pdf/WPS6025.pdf` (already cited by `savings-groups`). Add the file to content validation (`npm run validate`) via the schema.

- [ ] **Step 4: Run unit tests** — `npx vitest run tests/content/world-groups.test.ts && npm run validate`; Expected: PASS.

- [ ] **Step 5: Write the failing e2e test**

```ts
for (const lang of ["en", "sw"] as const)
  test(`${lang}: six savings-group names open to one line each`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    const items = page.locator("[data-world-list] details");
    await expect(items).toHaveCount(6);
    await items.first().locator("summary").click();
    await expect(items.first()).toHaveAttribute("open", "");
    await expect(page.locator("[data-world]")).toContainText(lang === "en" ? "Names do not mean identical rules or legal status." : "Majina hayamaanishi sheria au hali ya kisheria iliyo sawa.");
  });
```

- [ ] **Step 6: Implement `WorldGroups` and render it after `JoinQuestions`; build and verify** — `npm run build && npx playwright test e2e/home.spec.ts e2e/a11y.spec.ts`; Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add content/world-groups.json lib/content/schemas.ts lib/content/load.ts components/home/WorldGroups.tsx app/[lang]/page.tsx lib/site-copy.ts tests/content/world-groups.test.ts e2e/home.spec.ts
git commit -m "feat(home): list savings-group names from around the world"
```

---

### Task 5: Dot-pattern world map with markers, offline

**Files:**
- Create: `lib/map/project.ts`, `scripts/build-world-dots.ts`, `public/images/world-dots.svg`, `components/home/WorldMap.tsx`
- Modify: `app/[lang]/page.tsx` (pass `map` to `WorldGroups`), `public/sw.js` (`PRECACHE`, `cacheableStatic`), `ATTRIBUTIONS.md`
- Test: `tests/map/project.test.ts`, `e2e/world-map.spec.ts`

**Interfaces:**
- Produces: in `lib/map/project.ts`: `export const MAP = { width: 1000, latTop: 84, latBottom: -58 } as const`, `export const MAP_HEIGHT: number` (= `width * (latTop - latBottom) / 360`), `export function project(lat: number, lon: number): { x: number; y: number }` (equirectangular: `x = (lon + 180) / 360 * width`, `y = (latTop - lat) / (latTop - latBottom) * MAP_HEIGHT`).
- Produces: `WorldMap({ groups }: { groups: WorldGroup[] })`: `<figure data-world-map>` with `<img src="/images/world-dots.svg" alt="" width height>` and an `aria-hidden` overlay `<svg viewBox="0 0 1000 MAP_HEIGHT">` drawing one orange marker and name label per group.

- [ ] **Step 1: Write the failing unit test** (`tests/map/project.test.ts`)

```ts
import { expect, test } from "vitest";
import { MAP, MAP_HEIGHT, project } from "../../lib/map/project.ts";
test("corners and the equator project as the spec defines", () => {
  expect(project(MAP.latTop, -180)).toEqual({ x: 0, y: 0 });
  expect(project(MAP.latBottom, 180)).toEqual({ x: 1000, y: MAP_HEIGHT });
  expect(project(0, 0).x).toBe(500);
  expect(project(0, 0).y).toBeCloseTo((84 / 142) * MAP_HEIGHT, 6);
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/map/project.test.ts`; Expected: FAIL.

- [ ] **Step 3: Implement `lib/map/project.ts`; run the test** — Expected: PASS.

- [ ] **Step 4: Ask the owner before downloading.** Proposed file: `ne_110m_land.geojson` from `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson` (Natural Earth, public domain, ~100–200 KB), saved into a new empty directory in the scratchpad. Proceed only on an explicit yes. Record its SHA-256.

- [ ] **Step 5: Implement `scripts/build-world-dots.ts <path-to-geojson> <out.svg>`.** Lattice step 3° in both directions, cell centres from `lon = -178.5…178.5`, `lat = latTop - 1.5 … ≥ latBottom`; keep a point when it lies inside any land polygon (even-odd ray casting over each Polygon/MultiPolygon, outer ring minus holes). Write one `<path>` of `M{x} {y}h0` segments (one decimal), `stroke-linecap="round"`, stroke width 4.2, teal `#008080` at 55% opacity, `viewBox="0 0 1000 {MAP_HEIGHT}"`. Header comment: source URL, Natural Earth version, SHA-256, command used. Run it with `node scripts/build-world-dots.ts <tmp>/ne_110m_land.geojson public/images/world-dots.svg`; expected size ≤ 40 KB. Add a Natural Earth section to `ATTRIBUTIONS.md` (public domain, source, version).

- [ ] **Step 6: Write the failing e2e tests** (`e2e/world-map.spec.ts`)

```ts
import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { getWorldGroups } from "../lib/content/load.ts";
import { project } from "../lib/map/project.ts";

test("every marker sits on a land dot in the generated map", () => {
  const svg = fs.readFileSync("public/images/world-dots.svg", "utf8");
  const dots = [...svg.matchAll(/M([\d.]+) ([\d.]+)h0/g)].map((m) => ({ x: +m[1], y: +m[2] }));
  for (const g of getWorldGroups()) {
    const p = project(g.lat, g.lon);
    const nearest = Math.min(...dots.map((d) => Math.hypot(d.x - p.x, d.y - p.y)));
    expect(nearest, g.id).toBeLessThan(12);
  }
});

test("the map image loads and has six markers", async ({ page }) => {
  const res = page.waitForResponse((r) => r.url().endsWith("/images/world-dots.svg"));
  await page.goto("/en/");
  expect((await res).status()).toBe(200);
  await expect(page.locator("[data-world-map] svg [data-marker]")).toHaveCount(6);
});

test("the map is available offline after the first visit", async ({ page, context }) => {
  await page.goto("/sw/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  const ok = await page.evaluate(async () => (await caches.match("/images/world-dots.svg")) !== undefined);
  expect(ok).toBe(true);
  await context.setOffline(false);
});
```

- [ ] **Step 7: Build and run to verify failure** — `npm run build && npx playwright test e2e/world-map.spec.ts`; Expected: the marker/offline tests FAIL (no `WorldMap`, not precached).

- [ ] **Step 8: Implement `WorldMap`, pass it to `WorldGroups`, add `/images/world-dots.svg` to `PRECACHE` and `cacheableStatic` in `public/sw.js`.**

- [ ] **Step 9: Verify** — `npm run check && npm run build && npx playwright test e2e/world-map.spec.ts e2e/home.spec.ts e2e/public-release.spec.ts e2e/a11y.spec.ts && npm run check:ux-budget`; Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/map/project.ts scripts/build-world-dots.ts public/images/world-dots.svg components/home/WorldMap.tsx app/[lang]/page.tsx public/sw.js ATTRIBUTIONS.md tests/map/project.test.ts e2e/world-map.spec.ts
git commit -m "feat(home): draw savings-group names on a dot-pattern world map"
```

---

### Task 6: Dark mode, narrow screens, full verification and review list

**Files:**
- Modify: `e2e/a11y.spec.ts`, `e2e/home.spec.ts`
- Create (scratch, not committed): Kiswahili review list of the new strings

- [ ] **Step 1: Write the tests**

```ts
// e2e/a11y.spec.ts
for (const path of ["/sw/", "/en/"])
  test(`the homepage has no serious accessibility problems in dark mode (${path})`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "markup is the same on both projects");
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
```
In `e2e/home.spec.ts` change "no horizontal scroll at 320px in Kiswahili" to loop over `["sw", "en"]`.

- [ ] **Step 2: Run them** — `npm run build && npx playwright test e2e/a11y.spec.ts e2e/home.spec.ts`; fix any failure in the owning component (each fix gets a ledger line).

- [ ] **Step 3: Full suite** — `npm run check && npm run build && npm run check:ux-budget && npx playwright test`; Expected: all pass; report `UX home` against 144.51 KB.

- [ ] **Step 4: Kiswahili review list** of every new `sw` string (site-copy keys and `content/world-groups.json`), saved to the scratchpad for the owner.

- [ ] **Step 5: Commit**

```bash
git add e2e/a11y.spec.ts e2e/home.spec.ts
git commit -m "test(home): check the redesigned homepage in dark mode and on narrow screens"
```
