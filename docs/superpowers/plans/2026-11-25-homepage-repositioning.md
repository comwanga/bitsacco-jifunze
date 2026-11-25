# Homepage Repositioning (Batch 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the Jifunze homepage and path pages around community finance (chamas, SACCOs, personal savings) with Bitcoin as the strengthening layer, without changing lessons, routes or progress keys.

**Architecture:** Next.js static export. New user-facing copy lives in server-only `lib/site-copy.ts` (not the client-bundled `lib/i18n.ts`). Path-page intro copy is new optional bilingual roadmap JSON fields validated by the existing zod `RoadmapSchema`. Homepage additions are server-rendered links; no new client JavaScript.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript, Tailwind 4, zod 4, Vitest, Playwright (+ axe).

**Spec:** `docs/superpowers/specs/2026-11-25-homepage-repositioning-design.md`

## Global Constraints

- Roadmap ids (`savers`, `builders`, `lightning`), lesson slugs, URLs and progress keys do not change.
- Every user-facing string exists in Kiswahili (`sw`) and English (`en`); new strings go in `lib/site-copy.ts` (`siteCopy`), never as new keys in `lib/i18n.ts`.
- Homepage gzip JS must not exceed the baseline recorded in Task 1 (hard limit `UX_LIMITS.home = 144.9` KB).
- No form elements on the homepage or 404 (CSP is `form-action 'none'`; `e2e/public-release.spec.ts` asserts no `form, input` on 404).
- No analytics, no learner metrics; counts are computed from repository content.
- Kiswahili wording below is a draft; the owner reviews it (Task 8) before any staging push.
- Git: work on branch `feat/community-finance-homepage` from `origin/main`. Commit only if the owner has authorized commits; never push, open a PR or deploy without separate authorization. Commit messages carry no `Co-Authored-By` trailer.
- Node 24.20+, npm 12.0.2+. Run `npm ci --prefix api` once before `npm run check`.

## Review Focus

1. **Phone layout:** the four start links inserted above the path cards can push the first card past `1.2 × viewport` on Pixel 5, failing the existing `e2e/home.spec.ts` "on a phone the first path is close to the top". Expected: test still passes; use a compact two-column grid on mobile rather than relaxing the test (Task 4).
2. **Narrow screens with long Kiswahili:** at 320px the new hero, stats line and start links must not cause horizontal scrolling on `/sw/` (Task 4 test).
3. **Stale path name:** "Bitcoin for Savers" / "Bitcoin kwa Wawekaji" must not survive anywhere in built HTML (titles, metadata, breadcrumbs, catalogue filters) (Task 8 test).
4. **Glossary deep links:** each homepage term link must land on an existing glossary row id in both languages; a renamed/removed glossary id must fail a test, not silently 404 to the top of the page (Task 6 test).
5. **Path intro partial data:** a roadmap with only some intro fields (e.g. `format` without `outcomes`) must be a validation error, not a half-rendered section (Task 2 test).

---

### Task 1: Branch, baseline, and repositioned copy

**Files:**
- Modify: `lib/site-copy.ts` (add hero keys)
- Modify: `lib/i18n.ts` (remove `heroTitle`, `heroSubtitle`, `heroLead` from both dictionaries; change `branchSavers`, `sceneLabel`)
- Modify: `app/[lang]/page.tsx:16,44-46`, `app/[lang]/layout.tsx:29` (read hero copy from `siteCopy`)
- Modify: `content/roadmaps/savers.json` (`title`, `tagline`, `description`)
- Modify: `public/manifest.webmanifest` (`description`)
- Modify: `README.md` (Learning paths bullet for Savers; intro sentence)
- Test: `tests/i18n/site-copy.test.ts`

**Interfaces:**
- Produces: `siteCopy[lang].heroTitle`, `.heroSubtitle`, `.heroLead` (strings). All later tasks add keys to the same `en`/`sw` objects in `lib/site-copy.ts`.

- [ ] **Step 1: Create the branch and record the baseline**

```bash
git fetch origin && git switch -c feat/community-finance-homepage origin/main
npm ci && npm ci --prefix api
npm run check && npm run build && npm run check:ux-budget
```
Expected: all pass. Record the printed `UX home: X / 144.9 KB gzip JS` value as the baseline in the task notes.

- [ ] **Step 2: Write the failing test** (append to `tests/i18n/site-copy.test.ts`)

```ts
test("the hero leads with community finance in each language", () => {
  expect(siteCopy.en.heroTitle).toBe("Check before you save");
  expect(siteCopy.sw.heroTitle).toBe("Kagua kabla ya kuweka akiba");
  expect(siteCopy.en.heroSubtitle).toBe("Chamas, SACCOs, personal savings and Bitcoin");
  expect(siteCopy.sw.heroSubtitle).toBe("Chama, SACCO, akiba binafsi na Bitcoin");
  expect(siteCopy.en.heroLead).toMatch(/^Learn how savings groups and money tools really work/);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/i18n/site-copy.test.ts`
Expected: FAIL (`heroTitle` undefined).

- [ ] **Step 4: Implement the copy**

`lib/site-copy.ts` new keys (exact text):

| key | en | sw (draft) |
|---|---|---|
| heroTitle | Check before you save | Kagua kabla ya kuweka akiba |
| heroSubtitle | Chamas, SACCOs, personal savings and Bitcoin | Chama, SACCO, akiba binafsi na Bitcoin |
| heroLead | Learn how savings groups and money tools really work, what the real risks are, and how Bitcoin can make them stronger. Free, in Kiswahili or English, no sign-up. | Elewa jinsi vikundi vya akiba na zana za fedha zinavyofanya kazi, hatari zake halisi, na jinsi Bitcoin inavyoweza kuviimarisha. Bure, kwa Kiswahili au Kiingereza, bila kujisajili. |

Remove the three hero keys from both `lib/i18n.ts` dictionaries and switch their three call sites to `siteCopy[lang].…`. In `lib/i18n.ts`: `branchSavers` → sw `Jamii`, en `Community`; `sceneLabel` → sw `Mbuyu unaokua alfajiri, wenye matawi matatu: Jamii, Lightning na Wajenzi`, en `A baobab growing at sunrise, with three branches: Community, Lightning and Builders`.

`content/roadmaps/savers.json`:
- title: en `Community Finance & Bitcoin`, sw `Fedha za Jamii na Bitcoin`
- tagline: en `Understand chamas, SACCOs and personal savings, then see how Bitcoin strengthens them.`, sw `Elewa chama, SACCO na akiba binafsi, kisha uone jinsi Bitcoin inavyoviimarisha.`
- description: en `Start with money, savings, wallets and safety. Then choose personal savings, community savings groups or cooperative finance, and learn to judge risks, rules and records before you put money in. No programming needed.`, sw `Anza na pesa, akiba, pochi na usalama. Kisha chagua akiba binafsi, vikundi vya akiba vya jamii au fedha za ushirika, na ujifunze kupima hatari, sheria na kumbukumbu kabla ya kuweka pesa. Huhitaji kujua programu.`

`public/manifest.webmanifest` description: `Elewa chama, SACCO na akiba, na jinsi Bitcoin inavyoviimarisha. Understand chamas, SACCOs and savings, and how Bitcoin strengthens them.`

`README.md`: rename the Savers bullet to "Fedha za Jamii na Bitcoin / Community Finance & Bitcoin" and change the opening sentence to describe a "Kiswahili-first, bilingual community-finance and Bitcoin education platform". Leave screenshots.

- [ ] **Step 5: Run unit checks**

Run: `npm run check`
Expected: PASS (lint, typecheck, unit tests, content validation).

- [ ] **Step 6: Commit** (only if authorized)

```bash
git add lib/site-copy.ts lib/i18n.ts app/[lang]/page.tsx app/[lang]/layout.tsx content/roadmaps/savers.json public/manifest.webmanifest README.md tests/i18n/site-copy.test.ts
git commit -m "feat(home): lead with community finance and rename the Savers path"
```

---

### Task 2: Path intro (What you'll learn / How it works / Who it's for)

**Files:**
- Modify: `lib/content/schemas.ts` (`RoadmapSchema`)
- Create: `lib/content/path-intro.ts`
- Create: `components/roadmap/PathIntro.tsx`
- Modify: `app/[lang]/tree/[roadmap]/page.tsx`, `app/[lang]/list/[roadmap]/page.tsx` (render `PathIntro` directly after `PathHeader`)
- Modify: `content/roadmaps/savers.json`, `builders.json`, `lightning.json` (add fields)
- Modify: `lib/site-copy.ts` (three headings)
- Test: `tests/content/path-intro.test.ts`, `e2e/roadmap.spec.ts`

**Interfaces:**
- Produces: `RoadmapSchema` optional fields `outcomes: {sw,en}[]` (3–5), `format: {sw,en}`, `audience: {sw,en}`, all-or-none.
- Produces: `export type PathIntroCopy = { outcomes: string[]; format: string; audience: string }` and `export function pathIntro(roadmap: Roadmap, lang: Lang): PathIntroCopy | null` in `lib/content/path-intro.ts`.
- Produces: `PathIntro({ intro, lang }: { intro: PathIntroCopy; lang: Lang })` server component, root element `<section data-path-intro>`.
- Produces: `siteCopy` keys `pathOutcomesTitle` (en `What you'll learn`, sw `Utakachojifunza`), `pathFormatTitle` (en `How it works`, sw `Jinsi inavyofanya kazi`), `pathAudienceTitle` (en `Who it's for`, sw `Ni kwa ajili ya nani`).

- [ ] **Step 1: Write the failing unit tests** (`tests/content/path-intro.test.ts`)

```ts
import { expect, test } from "vitest";
import { RoadmapSchema } from "../../lib/content/schemas.ts";
import { listRoadmaps } from "../../lib/content/load.ts";
import { pathIntro } from "../../lib/content/path-intro.ts";

const base = { id: "savers", title: { sw: "a", en: "a" }, tagline: { sw: "a", en: "a" }, description: { sw: "a", en: "a" },
  sections: [{ id: "s", title: { sw: "a", en: "a" }, lessons: [{ slug: "x" }] }] };
const L = (s: string) => ({ sw: s, en: s });

test("intro fields are optional", () => expect(RoadmapSchema.safeParse(base).success).toBe(true));
test("intro needs 3 to 5 outcomes", () => {
  expect(RoadmapSchema.safeParse({ ...base, outcomes: [L("a"), L("b")], format: L("f"), audience: L("w") }).success).toBe(false);
  expect(RoadmapSchema.safeParse({ ...base, outcomes: [L("a"), L("b"), L("c")], format: L("f"), audience: L("w") }).success).toBe(true);
});
test("an outcome without Kiswahili is rejected", () => {
  expect(RoadmapSchema.safeParse({ ...base, outcomes: [L("a"), L("b"), { en: "c" }], format: L("f"), audience: L("w") }).success).toBe(false);
});
test("partial intro is rejected", () => expect(RoadmapSchema.safeParse({ ...base, format: L("f") }).success).toBe(false));
test("every path has a complete intro in both languages", () => {
  for (const r of listRoadmaps()) for (const lang of ["sw", "en"] as const) {
    const intro = pathIntro(r, lang);
    expect(intro, `${r.id}/${lang}`).not.toBeNull();
    expect(intro!.outcomes.length).toBeGreaterThanOrEqual(3);
  }
  expect(pathIntro(listRoadmaps()[0], "en")!.audience).toMatch(/^Anyone about to join/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/content/path-intro.test.ts`
Expected: FAIL (module `path-intro.ts` not found).

- [ ] **Step 3: Implement schema, helper and content**

Schema: add the three optional fields to `RoadmapSchema` and a `.superRefine` (or `.refine`) that requires all three or none. `pathIntro` returns `null` when the roadmap has no intro, otherwise the strings for `lang`.

Roadmap content (exact; sw is draft):

**savers**
- outcomes:
  1. en `How rotating groups, accumulating groups and SACCOs handle money, and where each one can fail` / sw `Jinsi vikundi vya mzunguko, vikundi vya kulimbikiza na SACCO vinavyoshughulikia pesa, na wapi kila kimoja kinaweza kushindwa`
  2. en `Questions to ask about rules, records and leadership before you join` / sw `Maswali ya kuuliza kuhusu sheria, kumbukumbu na uongozi kabla ya kujiunga`
  3. en `How to compare savings options by cost, access and who controls the money` / sw `Jinsi ya kulinganisha njia za kuweka akiba kwa gharama, upatikanaji na nani anadhibiti pesa`
  4. en `How to hold Bitcoin safely yourself, and how a group can use it with clear rules` / sw `Jinsi ya kushikilia Bitcoin mwenyewe kwa usalama, na jinsi kikundi kinavyoweza kuitumia kwa sheria zilizo wazi`
- format: en `Eight short introductory lessons, then a choice of personal, community or cooperative finance. Every lesson has a fictional case, a worked activity, discussion questions and a short quiz. No real money is used.` / sw `Masomo manane mafupi ya utangulizi, kisha uchague fedha binafsi, za kikundi au za ushirika. Kila somo lina mfano wa kubuni, zoezi, maswali ya majadiliano na jaribio fupi. Hakuna pesa halisi inayotumika.`
- audience: en `Anyone about to join or already in a chama, SACCO or savings group, anyone saving on their own, and people who lead or teach a group. No technical background needed.` / sw `Yeyote anayekaribia kujiunga au aliye tayari kwenye chama, SACCO au kikundi cha akiba, yeyote anayeweka akiba peke yake, na wanaoongoza au kufundisha kikundi. Huhitaji ujuzi wa kiufundi.`

**builders**
- outcomes: en `Run a private Bitcoin test network on your own computer` / sw `Endesha mtandao binafsi wa majaribio wa Bitcoin kwenye kompyuta yako`; en `Read transactions, keys and descriptors` / sw `Soma miamala, funguo na descriptors`; en `Understand how Lightning and Fedimint work underneath` / sw `Elewa jinsi Lightning na Fedimint zinavyofanya kazi ndani`; en `Contribute to open-source projects and ship a small tool for your community` / sw `Changia miradi ya chanzo huria na utengeneze zana ndogo kwa ajili ya jamii yako`
- format: en `Eight hands-on lessons on regtest, so no real money is involved. Each lesson ends with discussion and a quiz, and the last one is a project.` / sw `Masomo manane ya vitendo kwa kutumia regtest, kwa hiyo hakuna pesa halisi. Kila somo linaishia na majadiliano na jaribio, na la mwisho ni mradi.`
- audience: en `People comfortable with a terminal who want to build tools for savings groups and communities.` / sw `Watu wanaoweza kutumia terminal wanaotaka kujenga zana kwa ajili ya vikundi vya akiba na jamii.`

**lightning**
- outcomes: en `How payment channels, invoices and routing work` / sw `Jinsi njia za malipo, ankara na uelekezaji zinavyofanya kazi`; en `How nodes find paths and forward payments safely` / sw `Jinsi nodi zinavyotafuta njia na kupeleka malipo kwa usalama`; en `How to operate, back up and secure a node` / sw `Jinsi ya kuendesha, kuhifadhi nakala na kulinda nodi`
- format: en `Seventeen lessons adapted from Mastering the Lightning Network, with exercises you can run in a local lab. No real money is used.` / sw `Masomo kumi na saba yaliyotoholewa kutoka Mastering the Lightning Network, pamoja na mazoezi unayoweza kuendesha kwenye maabara ya ndani. Hakuna pesa halisi inayotumika.`
- audience: en `Builders who finished the Builders path or already know Bitcoin transactions, and want to run the payment rails communities use.` / sw `Wajenzi waliomaliza njia ya Wajenzi au wanaojua tayari miamala ya Bitcoin, wanaotaka kuendesha njia za malipo zinazotumiwa na jamii.`

- [ ] **Step 4: Run unit tests**

Run: `npx vitest run tests/content/path-intro.test.ts && npm run validate`
Expected: PASS.

- [ ] **Step 5: Write the failing e2e test** (append to `e2e/roadmap.spec.ts`)

```ts
for (const view of ["", "list/"] as const) test(`path intro shows three parts (${view || "tree"})`, async ({ page }) => {
  await page.goto(view ? `/en/${view}savers/` : "/en/savers/");
  const intro = page.locator("[data-path-intro]");
  await expect(intro.getByRole("heading", { level: 2 })).toHaveText(["What you'll learn", "How it works", "Who it's for"]);
  await expect(intro.locator("li")).toHaveCount(4);
});
```

- [ ] **Step 6: Implement `PathIntro` and render it in both path pages**

Render it directly after `PathHeader` in the tree and list pages (`pathIntro(getRoadmap(roadmap as RoadmapId), lang)`; render nothing on `null`). Headings are `h2`; outcomes are a `ul`. Same `max-w-3xl` column as `PathHeader`.

- [ ] **Step 7: Build and run the e2e test**

Run: `npm run build && npx playwright test e2e/roadmap.spec.ts e2e/tree.spec.ts e2e/a11y.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit** (only if authorized)

```bash
git add lib/content/schemas.ts lib/content/path-intro.ts components/roadmap/PathIntro.tsx app/[lang]/tree app/[lang]/list content/roadmaps lib/site-copy.ts tests/content/path-intro.test.ts e2e/roadmap.spec.ts
git commit -m "feat(paths): explain what each path teaches, how it works and who it is for"
```

---

### Task 3: Computed content counts

**Files:**
- Create: `lib/content/site-stats.ts`
- Modify: `app/[lang]/page.tsx` (stats line under the hero actions)
- Modify: `lib/site-copy.ts`
- Test: `tests/content/site-stats.test.ts`, `e2e/home.spec.ts`

**Interfaces:**
- Produces: `export type SiteStats = { lessons: number; languages: number; hours: number; glossaryTerms: number }` and `export function siteStats(lang: Lang): SiteStats` (lessons from `listRoadmaps`/`flatLessons`; minutes from `getLesson(...).frontmatter.minutes`; `hours = Math.round(totalMinutes / 60)`; `languages = LANGS.length`; `glossaryTerms = getGlossary().length`).
- Produces: `siteCopy` templates with `{n}`: `statsLessons` (en `{n} lessons`, sw `masomo {n}`), `statsLanguages` (en `{n} languages`, sw `lugha {n}`), `statsHours` (en `about {n} hours of reading`, sw `takriban saa {n} za kusoma`), `statsTerms` (en `{n} glossary terms`, sw `maneno {n} ya kamusi`).

- [ ] **Step 1: Write the failing tests**

`tests/content/site-stats.test.ts`:
```ts
import { expect, test } from "vitest";
import { siteStats } from "../../lib/content/site-stats.ts";
test("counts come from the content", () => {
  expect(siteStats("en")).toEqual({ lessons: 49, languages: 2, hours: 34, glossaryTerms: 57 });
  expect(siteStats("sw")).toEqual(siteStats("en"));
});
```
`e2e/home.spec.ts`:
```ts
test("the hero shows computed content counts", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("[data-stats]")).toHaveText(/49 lessons.*2 languages.*about 34 hours of reading.*57 glossary terms/s);
  await page.goto("/sw/");
  await expect(page.locator("[data-stats]")).toContainText("masomo 49");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/content/site-stats.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `siteStats` and render** a `<p data-stats>` under the hero actions, items joined with ` · `.

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/content/site-stats.test.ts && npm run build && npx playwright test e2e/home.spec.ts`
Expected: PASS, including the existing "main actions are on the first screen".

- [ ] **Step 5: Commit** (only if authorized)

```bash
git add lib/content/site-stats.ts app/[lang]/page.tsx lib/site-copy.ts tests/content/site-stats.test.ts e2e/home.spec.ts
git commit -m "feat(home): show lesson, language, hour and glossary counts"
```

---

### Task 4: Start links and numbered lead/compact path cards

**Files:**
- Modify: `app/[lang]/page.tsx` (`#njia` section)
- Modify: `components/home/PathCard.tsx`
- Modify: `lib/site-copy.ts`
- Test: `e2e/home.spec.ts`

**Interfaces:**
- Produces: `PathCard` props gain `number: number` (rendered zero-padded in `<span data-path-number>`), `variant: "lead" | "compact"` (on the root as `data-variant`), `outcome?: string` (rendered under the description when present). Existing `data-path-card` and `data-resume` stay.
- Produces: `siteCopy` keys `startTitle` (en `Where are you starting?`, sw `Unaanzia wapi?`), `startJoin` (en `I'm about to join a savings group`, sw `Ninakaribia kujiunga na kikundi cha akiba`), `startMember` (en `I'm already in a chama or SACCO`, sw `Tayari niko kwenye chama au SACCO`), `startSolo` (en `I want to save on my own`, sw `Nataka kuweka akiba peke yangu`), `startMove` (en `I want to move my group to Bitcoin`, sw `Nataka kuhamishia kikundi changu kwenye Bitcoin`), `leadOutcome` (en `After this path you can check a chama or SACCO before you join, compare ways to save, and plan group savings with Bitcoin.`, sw `Baada ya njia hii utaweza kukagua chama au SACCO kabla ya kujiunga, kulinganisha njia za kuweka akiba, na kupanga akiba ya kikundi kwa Bitcoin.`), `buildTitle` (en `Build the tools communities need`, sw `Jenga zana zinazohitajika na jamii`).

- [ ] **Step 1: Write the failing e2e tests**

```ts
test("community finance leads, builders follow as numbered tools paths", async ({ page }) => {
  await page.goto("/en/");
  const cards = page.locator("[data-path-card]");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute("data-path-card", "savers");
  await expect(cards.nth(0)).toHaveAttribute("data-variant", "lead");
  await expect(cards.locator("[data-path-number]")).toHaveText(["01", "02", "03"]);
  await expect(cards.nth(0)).toContainText("After this path you can check a chama or SACCO before you join");
  await expect(page.getByRole("heading", { name: "Build the tools communities need" })).toBeVisible();
});

for (const lang of ["en", "sw"] as const) test(`${lang}: four starting points link to existing lessons`, async ({ page }) => {
  await page.goto(`/${lang}/`);
  const links = page.locator("[data-start] a");
  await expect(links).toHaveCount(4);
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual([`/${lang}/savers/saving-together/`, `/${lang}/savers/#specializations`, `/${lang}/savers/money-and-bitcoin/`, `/${lang}/savers/group-payments/`]);
  await links.nth(1).click();
  await expect(page.locator("#specializations")).toBeVisible();
});

test("no horizontal scroll at 320px in Kiswahili", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/sw/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
```

- [ ] **Step 2: Build and run to verify failure**

Run: `npm run build && npx playwright test e2e/home.spec.ts`
Expected: the three new tests FAIL; existing tests pass.

- [ ] **Step 3: Implement**

Inside `<section id="njia">` (keep the id; `e2e/header.spec.ts` depends on it): an `h2` `startTitle` and `<nav data-start>` with the four links in the order of the test, laid out as a 2-column grid on mobile and 4 columns from `md`. Then the savers card with `variant="lead"`, `number={1}`, `outcome={siteCopy[lang].leadOutcome}`, full width; then an `h2` `buildTitle` and builders/lightning cards (`variant="compact"`, numbers 2 and 3) side by side from `md`. Compact cards drop the three-lesson list. The baobab, Lightning lab panel and the existing `pathsTitle` sr-only heading stay.

- [ ] **Step 4: Verify, including phone layout**

Run: `npm run build && npx playwright test e2e/home.spec.ts e2e/header.spec.ts e2e/a11y.spec.ts && npm run check:ux-budget`
Expected: all PASS, including "on a phone the first path is close to the top" (mobile project). If that phone test fails, tighten the mobile start-link layout; do not change the test without owner approval. Homepage JS ≤ the Task 1 baseline.

- [ ] **Step 5: Commit** (only if authorized)

```bash
git add app/[lang]/page.tsx components/home/PathCard.tsx lib/site-copy.ts e2e/home.spec.ts
git commit -m "feat(home): add starting points and lead with the community finance path"
```

---

### Task 5: Progress stays in this browser

**Files:**
- Modify: `components/home/ContinueLearning.tsx` (new props)
- Modify: `app/[lang]/page.tsx` (pass the strings)
- Modify: `lib/site-copy.ts`
- Test: `e2e/home.spec.ts` (extend "after a finished lesson the continue card links to the next one")

**Interfaces:**
- Produces: `ContinueLearning` props gain `localNote: string` and `manageLabel: string`; it renders the note and a link to `/${lang}/progress/`. Strings come from `siteCopy` keys `progressLocal` (en `Saved only in this browser.`, sw `Imehifadhiwa kwenye kivinjari hiki pekee.`) and `progressManage` (en `Manage progress`, sw `Dhibiti maendeleo`), passed as props so `lib/i18n.ts` does not grow.

- [ ] **Step 1: Extend the existing test** with:

```ts
await expect(card).toContainText("Imehifadhiwa kwenye kivinjari hiki pekee.");
await expect(card.getByRole("link", { name: "Dhibiti maendeleo" })).toHaveAttribute("href", "/sw/progress/");
```
and change the existing `card.getByRole("link")` to `card.getByRole("link", { name: /Endelea/ })` (the card now has two links).

- [ ] **Step 2: Build and run to verify failure**

Run: `npm run build && npx playwright test e2e/home.spec.ts -g "continue card"`
Expected: FAIL (text not found).

- [ ] **Step 3: Implement** the props and render them inside `[data-continue]`.

- [ ] **Step 4: Verify**

Run: `npm run build && npx playwright test e2e/home.spec.ts && npm run check:ux-budget`
Expected: PASS; homepage JS ≤ baseline.

- [ ] **Step 5: Commit** (only if authorized)

```bash
git add components/home/ContinueLearning.tsx app/[lang]/page.tsx lib/site-copy.ts e2e/home.spec.ts
git commit -m "feat(home): say that progress stays in this browser"
```

---

### Task 6: Glossary term links from the homepage

**Files:**
- Modify: `components/home/HowItWorks.tsx` (term links under the resource cards; must not be nested inside the glossary card `Link`)
- Modify: `app/[lang]/page.tsx` (pass the terms)
- Modify: `lib/site-copy.ts`
- Test: `e2e/home.spec.ts`

**Interfaces:**
- Consumes: `getGlossary()` rows `{ id, sw, en }` from `lib/content/load.ts`.
- Produces: `HowItWorks` prop `featuredTerms: { id: string; label: string }[]`, rendered as `<nav data-glossary-terms>` with links to `/${lang}/glossary/#${id}` plus a final link to `/${lang}/glossary/` labelled from `siteCopy` key `glossarySearchAll` (en `Search all {n} terms`, sw `Tafuta maneno yote {n}`). Featured ids, in order: `chama`, `rosca`, `quorum`, `self-custody`. The page throws at build time if any id is missing from the glossary.

- [ ] **Step 1: Write the failing test**

```ts
for (const lang of ["en", "sw"] as const) test(`${lang}: glossary term links land on real rows`, async ({ page }) => {
  await page.goto(`/${lang}/`);
  const links = page.locator("[data-glossary-terms] a");
  await expect(links).toHaveCount(5);
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual(["chama", "rosca", "quorum", "self-custody"].map((id) => `/${lang}/glossary/#${id}`).concat(`/${lang}/glossary/`));
  await links.nth(2).click();
  await expect(page.locator("#quorum")).toBeInViewport();
});
```

- [ ] **Step 2: Build and run to verify failure**

Run: `npm run build && npx playwright test e2e/home.spec.ts -g "glossary term links"`
Expected: FAIL.

- [ ] **Step 3: Implement** as specified in Interfaces. Plain links only (no form, no client code).

- [ ] **Step 4: Verify**

Run: `npm run build && npx playwright test e2e/home.spec.ts e2e/a11y.spec.ts && npm run check:ux-budget`
Expected: PASS, including the existing "library and glossary are cards with a clear action".

- [ ] **Step 5: Commit** (only if authorized)

```bash
git add components/home/HowItWorks.tsx app/[lang]/page.tsx lib/site-copy.ts e2e/home.spec.ts
git commit -m "feat(home): link community-finance glossary terms"
```

---

### Task 7: A 404 page that shows where to go

**Files:**
- Modify: `app/[lang]/not-found.tsx`
- Modify: `lib/site-copy.ts`
- Test: `e2e/not-found.spec.ts` (create)

**Interfaces:**
- Consumes: `listRoadmaps()` for path titles; `t(lang, "navGlossary")`, `t(lang, "navLibrary")`; `siteCopy[lang].heroBrowse` for "all lessons".
- Produces: two `<nav data-not-found-links lang="sw|en">` blocks, each with the heading from `siteCopy` key `notFoundNext` (en `Where to go next`, sw `Unaweza kwenda wapi sasa`) and links to `/{lang}/savers/`, `/{lang}/builders/`, `/{lang}/lightning/`, `/{lang}/learn/`, `/{lang}/glossary/`, `/{lang}/library/`. The existing headings and home links stay; no form or input.

- [ ] **Step 1: Write the failing test** (`e2e/not-found.spec.ts`)

```ts
import { expect, test } from "@playwright/test";
test("a missing page offers every main destination in both languages", async ({ page }) => {
  const response = await page.goto("/en/no-such-page/");
  expect(response!.status()).toBe(404);
  for (const lang of ["sw", "en"]) {
    const nav = page.locator(`[data-not-found-links][lang="${lang}"]`);
    const hrefs = await nav.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(["savers/", "builders/", "lightning/", "learn/", "glossary/", "library/"].map((p) => `/${lang}/${p}`));
  }
  await expect(page.locator("form, input")).toHaveCount(0);
});
```

- [ ] **Step 2: Build and run to verify failure**

Run: `npm run build && npx playwright test e2e/not-found.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** as specified in Interfaces.

- [ ] **Step 4: Verify**

Run: `npm run build && npx playwright test e2e/not-found.spec.ts e2e/public-release.spec.ts e2e/a11y.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (only if authorized)

```bash
git add app/[lang]/not-found.tsx lib/site-copy.ts e2e/not-found.spec.ts
git commit -m "feat(404): list every main destination in both languages"
```

---

### Task 8: Full verification and Kiswahili review packet

**Files:**
- Test: `e2e/positioning.spec.ts` (create)
- Create (scratch, not committed): a Kiswahili review list of every new or changed `sw` string with its English pair and file location

- [ ] **Step 1: Write the stale-name test** (`e2e/positioning.spec.ts`)

```ts
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
test("the old Savers path name is gone from the built site", () => {
  const hits: string[] = [];
  const walk = (dir: string) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".html") && /Bitcoin for Savers|Bitcoin kwa Wawekaji/.test(fs.readFileSync(p, "utf8"))) hits.push(p);
  } };
  walk(path.join(process.cwd(), "out"));
  expect(hits).toEqual([]);
});
```

- [ ] **Step 2: Run the full suite**

```bash
npm run check
npm run build
npm run check:ux-budget
npx playwright test
```
Expected: all pass. Compare `UX home` with the Task 1 baseline and report both numbers. If a lesson's MDX body still contains the old name in prose, report it to the owner rather than editing lesson content (out of scope).

- [ ] **Step 3: Review the diff**

Run: `git diff origin/main --stat` and read the full diff for unintended changes (no slug, id or route changes; no new `lib/i18n.ts` keys).

- [ ] **Step 4: Hand over** the verification output, the JS baseline comparison and the Kiswahili review list to the owner. Staging push (`docs/deployment/railway-staging.md`) happens only after the owner approves the Kiswahili and authorizes the push.

- [ ] **Step 5: Commit** (only if authorized)

```bash
git add e2e/positioning.spec.ts
git commit -m "test(home): guard against the retired Savers path name"
```
