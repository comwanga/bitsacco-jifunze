# Phase 1: learning experience (approved design)

> **Historical phase record.** Decisions, proposals, hostnames, pending gates and results below describe this dated phase, not current operating instructions. See [current guides](../../README.md).

Nov 3, 2026 · approved by the maintainer ("approved, use comwanga/bitsacco-jifunze and start phase 1")

Source: the platform audit of Nov 3, 2026 (sections A–G). This file keeps the Phase 1 decisions that the plan argues from.

## Intent

Make Jifunze easy to browse and pleasant to learn in, before any accounts exist. A first-time visitor sees where to start. A returning learner is offered their next lesson. A learner inside a lesson always knows where they are. Nothing in Phase 1 needs a server.

## In scope (essential, in this order)

1. **Browser test harness.** Playwright and axe in CI, covering navigation, language switching, offline reload, reduced motion and no horizontal overflow at 360 px.
2. **Lesson reader layout:**
   - Desktop (≥1100 px): a left course sidebar showing sections, lessons and ticks; the article in the centre; a right column with a table of contents built from the `##` headings, the objectives and progress.
   - Narrower screens: a sticky bar with "Lessons" and "On this page" menus, and the article full width.
   - Reading progress shown as a thin bar.
   - Heading anchors come from a small in-repo remark plugin, with no new dependency.
3. **Home:**
   - The baobab gets a third labelled limb, Lightning.
   - Path cards replace the full lesson lists, each showing audience, counts, minutes, level, the first three lessons and a Start or Resume button.
   - A "continue learning" card, driven by local progress.
   - A labs strip.
   - A shorter hero on phones.
4. **Catalogue** at `/[lang]/learn/`: every lesson in one list, with text search and filters for path, level and type (reading / quiz / lab). The header's "Njia" link points here, and a "Maabara" (Labs) link is added.
5. **Roadmap page:** lesson-type badges, a Resume button, and per-section progress.
6. **Housekeeping:**
   - `REPO_URL` = `https://github.com/comwanga/bitsacco-jifunze`; `SITE_URL` stays a placeholder.
   - Add `sitemap.xml` and `robots.txt`.
   - Correct the spec's attribution tables (lines 47–53, 120–121) to say these lessons are original.
   - A quiz passed at 75% or more marks a lesson without lab exercises as complete.
   - Restrict the service worker's fallback cache to known static paths.

## Out of scope for this phase

Accounts, GitHub or Nostr, any backend, builder profiles, community features, the tree view and the simulations. The tree view and simulations come after Phase 1 and need their own go-ahead.

## Constraints

- **JavaScript:** non-lab pages may grow by at most 3 KB gzip over the baseline (lesson 144.3 KB, home 141.9 KB, roadmap 142.1 KB). Lab pages may grow by at most 3 KB over 150.2 KB.
- **Accessibility:** no serious or critical axe violations on the pages tested. All features keyboard-operable. Nothing hidden behind animation, and reduced motion shows the static states.
- **Language:** Kiswahili and English stay at parity; the existing dictionary-keys test enforces it.
- **Offline:** offline reading still works.
- **No new runtime dependencies.** Dev dependencies are allowed only for the test harness.
- **Commits:** signed, with no co-author trailers. Nothing is pushed without the maintainer's go-ahead.
