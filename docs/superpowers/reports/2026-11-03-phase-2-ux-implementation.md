# Phase 2 implementation report

2026-11-03 · local branch `feat/phase-2-ux`

## Delivered

Learning trees now cover all 33 lessons across the three existing paths. Native list/tree navigation, section headings, connected cards, lesson numbers, completion ticks, types, minutes, multiple prerequisite links and Start/Continue/Review all reuse the existing curriculum and progress components. Trees remain navigable without JavaScript.

Both bilingual simulations are implemented: deterministic UTXO coin selection/payment/fee/change accounting, and settled Alice/Bob channel-balance changes. They provide explanations, worked examples, model limitations, associated validation errors, previews/balance graphics, textual results, history and Reset. Implementation chunks load only after Start. Four lesson entry points come from the central registry; simulations link back to the related lessons. The sitemap contains 96 localized pages.

## Branch and commits

The branch was created from updated main at verified merge `1a1ad0d291e949c1a70748022e9ac36149977a15`. Implementation history before this final integration/report commit:

| Commit | Purpose |
| --- | --- |
| `e649a22` | Reconcile Phase 2 documents with merged Phase 1 and approved scope |
| `f092dba` | Tree data contracts, registry and bilingual copy |
| `79c3814` | Server-rendered trees and shared path header |
| `bd0659a` | Simulation pages, deferred loading and retry |
| `c1868cd` | Correct service-worker asset precaching |
| `b821594` | UTXO model and interface |
| `f25838e` | Channel model and interface |
| `0077e96` | Lesson discovery, routes and offline integration |

All commits are signed without co-author trailers. Publication has not been authorized; no Phase 2 push or PR was performed.

## Files changed

- Routes: `app/[lang]/tree/[roadmap]/`, `app/[lang]/simulations/`, the existing roadmap/lesson/catalogue pages and `app/sitemap.ts`.
- UI: `components/roadmap/{PathHeader,PathViewLinks,PathTree}.tsx`, `tree.css`, and `components/simulations/` for the static shell, loader, practice links and two interfaces.
- Data/models: `lib/content/{tree,routes}.ts`, `lib/simulations/{registry,copy,amount,utxo,channel}.ts`; three shared navigation labels in `lib/i18n.ts`.
- Verification: model/content/i18n/PWA/budget tests, `e2e/{tree,simulations,utxo,channel,practice,interaction,simulation-a11y,budget}.spec.ts`, browser script-measurement helper, existing smoke/metadata assertions, and `scripts/check-ux-budget.ts` with `lib/build/ux-budget.ts`.
- Delivery: CI budget step, package script, README, Phase 2 design/plan and this report. Lesson MDX, live-lab implementation, local progress model and dependency lockfile are unchanged.

## Verification evidence

- `npm run check`: lint and TypeScript pass; **117 unit tests across 24 files pass**; content validation has zero errors and the existing 69 draft/terminology warnings.
- `npm run build`: production static export, CSP, internal links and general transfer checks pass. `npm run check:ux-budget` passes every scoped initial page cap and checks that simulation pages do not receive live-lab connection permissions.
- Full Chromium Playwright suite: **113 passed, 39 intentional skips**, across desktop and mobile projects. Later focused confirmations passed: 11 loader/budget checks and 8 flows preserving nonempty existing progress.
- Axe: no serious/critical findings on all six trees, both simulation indices, and initial/active/input-error simulation states in both languages; light/dark variants are covered. The failed-download state also passes axe.
- Browser coverage includes real keyboard and touch actions, stable focus, reduced motion, 360 px layouts, blocked storage, no-JavaScript explanations/navigation, both-language switching and the lesson → practice → lesson journey. Existing home, reader, catalogue and quiz/lab-completion regressions pass.
- Offline checks pass for direct and in-app lesson reloads, both activated simulations in both languages after reload, and a never-loaded module that fails usefully offline then recovers online. The cache allowlist remains restricted to known assets/data/navigation.
- **41 live-lab Python unit tests pass** in an isolated container with networking disabled and the repository mounted read-only. Existing runner resource warnings remain. Running learner nodes were not reset; the full state-changing live-node model-solution smoke suite was not rerun.
- Reviewed desktop English and 360 px Kiswahili screenshots of seeded-progress trees and both active interfaces. No clipping or horizontal overflow was found.

## JavaScript measurements

Gzip KB, using the final production export. Initial page maxima are measured across both languages with `pageWeight`; browser totals additionally capture service-worker and dynamically imported script requests, count assets once and wait for network idle.

| Measurement | Observed | Ceiling |
| --- | ---: | ---: |
| Home, initial HTML script references | 143.13 | 144.9 |
| Catalogue, initial references | 141.99 | 145.0 |
| Roadmap and tree, initial references | 143.32 | 145.1 |
| Standard lesson, initial references | 145.71 | 147.3 |
| Live lab, initial references | 151.62 | 153.2 |
| Simulation, initial references | 141.47 | 145.0 |
| Simulation, actual initial requests | 144.55 | 145.0 |
| UTXO, actual activated requests | 146.62 | 150.0 |
| Channel balances, actual activated requests | 146.11 | 150.0 |
| Additional UTXO chunks | 2.07 | 6.0 |
| Additional channel chunks | 1.56 | 6.0 |

Both languages passed the activated budgets. The budget test logs measurements and writes `script-budget.json` in its test output directory; subsequent Playwright invocations replace that directory. No ceiling was increased.

## Security, corrections and limits

The pure arithmetic models neither sign nor broadcast, generate keys, access wallets, contact nodes nor write progress. Successful and rejected state transitions preserve the tested accounting invariants. Browser flows preserve existing stored progress, including after Reset; blocked-storage flows require no storage. No runtime dependency or CSP permission was added.

Evidence justified one extra service-worker correction: the old precache scanned every static-looking path in HTML, including a 38.70 KB legacy `noModule` polyfill and serialized paths. Actual browser requests exposed totals around 183–185 KB despite acceptable initial HTML-reference sizes. A failing regression preceded the correction to inspect actual modern asset tags. The allowlist was not expanded. This brought requested totals under the unchanged limits.

Two small loader corrections followed browser evidence: the no-JavaScript message is initial HTML removed after hydration, and the disabled Start button retains full contrast to avoid a hydration-time opacity race in axe. The rest of the approved feature scope is unchanged. Longer simulation copy is isolated from existing browser dictionaries as designed.

These remain deliberately simplified models. The UTXO example does not implement dust/relay policy or real fee estimation; the channel example omits reserves, fees, pending HTLCs, routing, signing and timelocks. State resets on reload. A never-cached interactive chunk needs connectivity. Browser verification uses Chromium desktop/mobile emulation; other engines were not exercised. Remote CI has not run for this unpushed branch.

No implementation task remains. Publication and review are the next steps when authorized. The initial untracked `image.png` was not targeted by implementation commands, but was found absent during final verification; the cause is unconfirmed and was raised with the maintainer. No replacement or guessed restoration was made.
