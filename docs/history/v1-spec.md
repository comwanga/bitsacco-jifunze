# Bitsacco Jifunze — v1 Spec

> **Historical design, 2026-11-03.** This two-roadmap proposal predates the implemented Lightning path, learning trees, simulations and generated English PDF. Its proposed hostname, review status and performance targets are not current deployment instructions. See the [current documentation](../README.md) and [production runbook](../deployment/production.md).

Nov 3, 2026 · @colmwanga

Bitsacco Jifunze is a free, Kiswahili-first Bitcoin learning platform in its own repo, `comwanga/bitsacco-jifunze`, launching with two roadmaps: one for savers and one for builders. Version 1 is a static site with no accounts or backend; bitsacco.com only links to it.

## Goals

Version 1 succeeds when a Bitsacco member can learn the basics of Bitcoin saving on a phone, in Kiswahili, without signing up.

**Goals**

- Teach savers and chama members how Bitcoin money, keys and wallets work, and how to stay safe from scams.
- Give developers a path from Bitcoin basics to building on Fedimint and Bitsacco mini-apps.
- Every lesson ships in Kiswahili and English.
- Work well on low-end Android phones and slow or metered connections, including offline reading.
- Grow through community pull requests: translations, fixes and new lessons.

**Non-goals for version 1**

- User accounts, synced progress, certificates or leaderboards.
- Rewards in sats, or anything that holds or moves user funds.
- GitHub sync, peer review, admin dashboards or partner portals (the bulk of Pull's code).
- Financial or investment advice. Lessons explain how things work; they don't tell people what to buy.

## Audience and roadmaps

Version 1 launches two short roadmaps of about 8 lessons each, so both can be written, translated and reviewed well before launch. The lesson lists below are a proposal to edit.

**Savers: "Bitcoin kwa Wawekaji" (Bitcoin for savers).** For Bitsacco members, chama groups and anyone new to Bitcoin. No technical background assumed.

| # | Lesson | Source |
| --- | --- | --- |
| 1 | What money is, and why Bitcoin exists | Original |
| 2 | Sats, prices and volatility: saving in Bitcoin vs shillings | Original |
| 3 | Wallets, keys and seed phrases | Original, links to Kujifunza Bitcoin |
| 4 | Self-custody vs custodial vs Fedimint ecash | Original |
| 5 | Lightning payments: sending and receiving sats | Original |
| 6 | Scams and how to spot them | Original |
| 7 | Saving together: chamas and group savings with Bitsacco | Original |
| 8 | Next steps: books, the whitepaper and community | Original, links to the Bitsacco library |

**Builders: "Bitcoin kwa Wajenzi" (Bitcoin for builders).** For developers who want to build on Bitcoin, Lightning and Fedimint, and contribute to Bitsacco.

| # | Lesson | Source |
| --- | --- | --- |
| 1 | Developer environment and a local regtest lab | Original |
| 2 | UTXOs and transactions | Original |
| 3 | Keys, addresses and descriptors | Original |
| 4 | Lightning: channels, invoices and routing basics | Original |
| 5 | Fedimint: federations, ecash and guardians | Original |
| 6 | Building a Bitsacco mini-app | Original |
| 7 | Contributing to Bitsacco open source | Original |
| 8 | Project: ship a small Lightning or Fedimint tool | Original |

Kujifunza Bitcoin, the Kiswahili edition of Mastering Bitcoin, is the long-form companion for both roadmaps. Lessons link to its chapters rather than copying them.

## Version 1 scope

Version 1 is everything a reader needs and nothing that needs a server.

| Feature | Version 1 | Notes |
| --- | --- | --- |
| Roadmap pages | Yes | A list of sections and lessons with progress ticks. Simpler than Pull's visual map; works on small screens. |
| Lesson reader | Yes | Objectives, body, key terms, resources, reflection prompts, previous/next. |
| Kiswahili and English | Yes | Kiswahili is the default; a language switch on every page. |
| Quizzes | Yes | A few multiple-choice questions per lesson, checked in the browser. |
| Progress | Yes, on the device | Saved in the browser. Export and import as a small file so people can move phones. |
| Offline reading | Yes | Installable web app; lessons opened once stay readable offline. |
| Library | Yes | The whitepaper (EN/SW) and Kujifunza Bitcoin, linked from lessons. |
| Glossary | Yes | Kiswahili and English Bitcoin terms, kept consistent across lessons. |
| Accounts and synced progress | Later | Phase 2. |
| Certificates and chama cohorts | Later | Phase 2. |
| Sat rewards | Later | Phase 3, after a separate design and risk review. |

## Architecture

&#91;embedded content: Jifunze architecture · version 1\]

Every change reaches readers only through a reviewed pull request and a green CI run. The live site is plain files, so there is no database, login or secret to protect in version 1.

## Content format

Lessons are MDX files in git, one per language, so translations and fixes arrive as ordinary pull requests. This follows Pull's design, which is its strongest part.

```
content/
  roadmaps/
    savers.json          # sections, lesson order, prerequisites
    builders.json
  savers/
    sw/wallets-keys.mdx  # Kiswahili
    en/wallets-keys.mdx  # English, same slug
  builders/
    sw/...
    en/...
  quizzes/
    savers/wallets-keys.json
  glossary.json          # term pairs, e.g. seed phrase = maneno ya siri
```

Each lesson's front matter carries: `title`, `description`, `level`, `minutes`, `objectives`, `resources` (title, url, kind, language), `reflection`, `source` (original or adapted, with credit), `translationOf` and `lastReviewed`.

**Rules enforced in CI**

1. Every lesson exists in both `sw` and `en` with the same slug, or is marked `translationPending` and shows a notice.
2. Front matter matches the schema; every roadmap entry points to a real lesson.
3. Every quiz answer is valid and every link in `resources` is well formed.
4. Adapted lessons name their source and licence in `source`.
5. Glossary terms are used consistently (warning, not failure).

## Licensing and attribution

Use two licences, like Pull: MIT for code and CC BY-SA 4.0 for the curriculum. CC BY-SA is required anyway for anything adapted from Pull or Mastering Bitcoin.

| Material | Licence | What Jifunze must do |
| --- | --- | --- |
| Jifunze code | MIT (proposed) | Add `LICENSE`. The main bitsacco repo currently has no licence file, so confirm the org is happy with MIT. |
| Jifunze curriculum (`content/`) | CC BY-SA 4.0 | Add `content/LICENSE`; contributors agree their lessons and translations are released under it. |
| Code reused from Pull | Not used | No Pull code is used; Jifunze's validation scripts and content loaders are original. |
| Lessons adapted from Pull | Not used | No Pull lessons are used; the curriculum is original and links to companion reading. |
| Pull name and logo | Reserved by Pull | Don't use them. Jifunze has its own name and Bitsacco branding. |
| Kujifunza Bitcoin and the whitepaper | CC BY-SA 4.0 / as published | Link to them; keep the existing credits (Antonopoulos and Harding, translated by comwanga). |

## Security, privacy and performance

A static site with no accounts has very little to attack or leak, and that is a deliberate choice for version 1.

**Security**

- Same npm hardening as the bitsacco repo: `strict-peer-deps`, `ignore-scripts`, `allow-git=none`, `allow-remote=none`, pinned Node and npm versions.
- No secrets in version 1. Nothing to store, so nothing in `.env`.
- Strict Content Security Policy; no third-party scripts. Serve the pdf.js worker locally rather than from unpkg, as bitsacco.com does today.
- MDX is compiled at build time from reviewed files only, never from user input.

**Privacy**

- No Google Analytics, no tracking cookies and no cookie banner needed.
- Progress lives only on the reader's device.
- If usage numbers are needed, use server-side aggregate counts or a self-hosted, cookie-free tool. Decide before launch.

**Performance budget (low-end Android, 3G)**

| Measure | Budget |
| --- | --- |
| First lesson page, transferred | Under 200 KB |
| JavaScript per page | Under 100 KB compressed |
| Images | Compressed, sized for phones, lazy loaded |
| Large PDFs | Linearized and compressed (as done for Kujifunza Bitcoin), with the size shown before download |

## Repo, CI and deployment

The repo is `comwanga/bitsacco-jifunze`, using the same stack as bitsacco.com (Next.js 16, React 19, TypeScript, Tailwind 4) but built as a static export.

```
bitsacco-jifunze/
  app/[lang]/                 # sw and en routes
    page.tsx                  # home: pick a roadmap
    [roadmap]/page.tsx        # roadmap page
    [roadmap]/[lesson]/page.tsx
    library/page.tsx
  components/                 # reader, quiz, progress, language switch
  content/                    # lessons, roadmaps, quizzes, glossary
  lib/content/                # loaders and schemas
  scripts/validate-content.ts
  public/                     # images, PDFs, web app manifest
  ATTRIBUTIONS.md  LICENSE  content/LICENSE  CONTRIBUTING.md
```

**CI on every pull request:** install with `npm ci`, then lint, typecheck, unit tests, content validation, build, and a link check of the built site. Same Node and npm versions as the bitsacco repo.

**Deployment:** `next build` with `output: 'export'` produces plain HTML, CSS and JS. Serve it from a small non-root static web server container, or any static host. There is no app server, database or secret to run.

**Link from bitsacco.com:** once the URL exists, add one external footer link (for example "Jifunze" under Resources, opening in a new tab), and optionally from the Learn about Bitcoin page. The footer already supports external links.

## Phases

&#91;embedded content: Phases and gates · no dates set\]

No dates are set; each phase is planned when its gate is reached. Version 1 launches when all 16 lessons are reviewed in both languages and the performance budget is met.

## Open decisions

These need an answer before building starts; none blocks writing lessons.

- [ ] **Live URL.** For example `jifunze.bitsacco.com`. Needed for metadata, the sitemap and the bitsacco.com link.
- [x] **Repository.** `comwanga/bitsacco-jifunze` is the public project repository.
- [ ] **Code licence.** Confirm MIT for Jifunze code; the main bitsacco repo has no licence today.
- [ ] **Hosting.** Where the static site runs (the same infrastructure as bitsacco.com, or a static host).
- [ ] **Lesson lists.** Approve or edit the 8 + 8 lessons above.
- [ ] **Reviewers.** Who checks Kiswahili wording and who checks technical accuracy for each roadmap.
- [ ] **Usage numbers.** No analytics, or a cookie-free self-hosted option.
- [ ] **Name in Kiswahili and English.** "Bitsacco Jifunze" everywhere, or "Bitsacco Learn" on English pages.

## Sources

- [Pull repository](https://github.com/Megasley/pull): README, ROADMAP, licences, content layout (read 2026-11-03)
- [Pull curriculum licence](https://github.com/Megasley/pull/blob/main/content/LICENSE)
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- [Mastering Bitcoin source](https://github.com/bitcoinbook/bitcoinbook)
- [bitsacco/bitsacco](https://github.com/bitsacco/bitsacco): stack, npm and Docker hardening, Learn about Bitcoin page (PR #107)
