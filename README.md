# Bitsacco Jifunze

A free, Kiswahili-first Bitcoin learning platform with three roadmaps:

- **Bitcoin kwa Wawekaji** (Bitcoin for Savers), for Bitsacco members, chama groups and anyone new to Bitcoin.
- **Bitcoin kwa Wajenzi** (Bitcoin for Builders), for developers building on Bitcoin, Lightning and Fedimint.
- **Lightning kwa Wajenzi** (Lightning for Builders), all 17 chapters of *Mastering the Lightning Network*, simplified, with a live lab: an in-page CLI/Python editor that runs against regtest Lightning nodes in Docker on your laptop. See [lab/README.md](lab/README.md).

Every lesson ships in Kiswahili and English. Learning needs no account and no backend: the site is a static export. Progress lives in the reader's browser and can be exported to a file and imported on another phone. Lessons opened once stay readable offline.

## Stack

Next.js 16 (static export), React 19, TypeScript, Tailwind CSS 4, MDX compiled at build time, Vitest. This is the same stack and npm hardening as [bitsacco/bitsacco](https://github.com/bitsacco/bitsacco).

## Requirements

- Node.js 24 (24.20.0 or newer) and npm 12
- Docker, optional, for the container

## Develop

```bash
npm ci
npm run dev          # http://localhost:3000/sw/
```

## Check everything

```bash
npm run check        # lint, typecheck, unit tests, content validation
npm run build        # static export to out/, then CSP hashes, link check and performance budget
npm run check:ux-budget # stricter Phase 1/2 page budgets, after the build
npm run e2e          # Chromium desktop/mobile flows, axe and activated script budgets
```

`npm run build` runs `scripts/postbuild.ts` after `next build`. It:

- adds a per-page Content Security Policy with hashes of that page's inline scripts;
- stamps the service worker with the build ID;
- fails on any broken internal link;
- fails if the first lesson page is over **200 KB** gzip, or if ordinary-page JavaScript is over **150 KB** gzip (**165 KB** for live labs). It also warns above the spec's 100 KB target; see "Known gaps" below.

CI additionally runs `npm run check:ux-budget` for the tighter Phase 1/2 limits and browser checks for requested simulation chunks. Install the browser once with `npx playwright install chromium` before running local browser checks.

## Learning trees and practice

Each roadmap offers **List / Tree** navigation. The tree uses the existing sections, lesson order, prerequisites and saved progress. Its lesson links also work without JavaScript; prerequisites are suggestions and never lock a lesson.

- `/{lang}/tree/{savers,builders,lightning}/`: learning trees.
- `/{lang}/simulations/`: practice index, linked from the catalogue.
- `/{lang}/simulations/utxo/`: example coin selection, inputs, payment, fees and change.
- `/{lang}/simulations/channel-balances/`: settled two-party payments with a fixed 100,000 sat model capacity.

Simulation explanations and worked examples are server-rendered in Kiswahili and English. Start loads only the chosen interactive module. The designated lessons link to simulations through a central registry, and every simulation links back to its lessons. These are arithmetic practice models: they do not sign, broadcast, connect to a node or mark lessons/exercises complete. Model state resets on reload.

Previously opened explanations remain readable offline. An interactive module works offline after it has been activated and cached; a never-loaded module needs a connection and shows a retry message. Browser tests cover both cases. Service-worker asset precaching excludes legacy-only polyfills and reads actual asset tags.

Initial JavaScript caps (gzip KB) are home 144.9, catalogue 145.0, roadmap/tree 145.1, ordinary lesson 147.3, live lab 153.2, and simulation pages 145.0. Activated simulations must stay within 150.0 KB total and 6.0 KB of additional chunks. Browser measurements include requests from the service worker and dynamic imports; passing an initial HTML-reference measurement alone is insufficient.

See the [Phase 2 design](docs/superpowers/specs/2026-11-03-phase-2-ux-design.md) and [implementation plan](docs/superpowers/plans/2026-11-03-phase-2-ux.md) for scope and verification.

## Run the container

```bash
docker build -t jifunze .
docker run --rm -p 8080:8080 jifunze   # http://localhost:8080/sw/
```

The image serves plain files from `nginxinc/nginx-unprivileged` as a non-root user. There is no app server, database or secret.

## Akaunti (account) stack

The optional account (GitHub sign-in and recovery codes) is a small Node 24 API in [`api/`](api/) with PostgreSQL. nginx serves the site and proxies `/api/` to it. The site starts and serves pages without the API.

```bash
cp api/.env.example api/.env.local   # fill in the GitHub App and the recovery pepper
docker compose up --build            # http://localhost:8080/sw/account/
```

- `api/.env.local` is git-ignored and is not sent to Docker builds. Secrets are never committed: compose reads them at run time.
- Open `http://localhost:8080`, not `127.0.0.1:8080`: the API checks each POST's origin against `SITE_ORIGIN` (`http://localhost:8080`) and refuses others with `bad_origin`.
- Only the site is published, on `127.0.0.1:8080`. The API and the database have no host port. This is a local development stack, not a production boundary.
- nginx logs `/api/` requests without their query strings and suppresses its own `/api/` error lines below `crit`, since they would quote the GitHub callback's code and state. In an outage, read the access log's status and `upstream=` fields and `docker compose logs api`.
- Sign in locally with Chromium or Firefox. The session cookie is `__Host-` and `Secure`, and Safari/WebKit refuses it on `http://localhost`.
- The rate limits live in the API's memory, so they reset whenever it restarts.
- GitHub requires the `redirect_uri` to match a registered callback. Register all three on the GitHub App: `/api/auth/github/callback`, `/api/auth/github/callback/reauth` and `/api/auth/github/callback/replace` (for example `http://localhost:8080/api/auth/github/callback`).

```bash
export TEST_DATABASE_URL=postgres://...   # a throwaway PostgreSQL database
npm run api:test
npm run build && npm run e2e:account      # Chromium, against the real API and a fake GitHub
```

`npm run e2e:account` starts a fake GitHub (`api/test/fake-github-server.ts`) with a test-only consent page. It is not real GitHub authentication. CI runs both, validates `compose.yaml` and builds the API image.

## Content

Lessons, roadmaps, quizzes and the glossary live in [`content/`](content/) and are licensed CC BY-SA 4.0. See [CONTRIBUTING.md](CONTRIBUTING.md) to add or translate a lesson.

```
content/
  roadmaps/{savers,builders}.json      sections, lesson order, prerequisites
  {savers,builders}/{sw,en}/<slug>.mdx one file per language, same slug
  quizzes/{savers,builders}/<slug>.json bilingual multiple-choice questions
  glossary.json                        Kiswahili and English term pairs
  library.json                         whitepaper and Kujifunza Bitcoin links
```

## Project layout

```
app/[lang]/            sw and en routes: home, roadmap, lesson, library, glossary, progress, offline
components/            intro scene, reader parts, quiz, progress transfer, layout
lib/content/           schemas, loaders, MDX rendering, content validation
lib/progress/          on-device progress model, storage and React hook
lib/build/             post-build CSP, link and budget helpers
scripts/               validate-content.ts, postbuild.ts, make-icons.mjs
public/                service worker, web app manifest, icons, logo
api/                   account API (Node 24, PostgreSQL), its migrations and tests
e2e-account/           account browser checks against the API and a fake GitHub
docker/                nginx config, security headers and the API image
```

## The Lightning lab

```bash
cd lab
./lab doctor && ./lab up      # four regtest nodes + the bridge on 127.0.0.1:7777
./lab pair                    # paste the code into the lab bar on any Lightning lesson
```

Lessons with exercises load a small lazy island (the editor) and get a CSP that allows `connect-src` to the local bridge and to Codespaces. Every exercise has a model solution and a check; CI starts the lab and runs them all (`lab/tests/smoke_solutions.py`).

## Known gaps

- **Lab egress.** Learner code inside the lab container can reach the internet. An internal-only Docker network would also block the bridge port; only the paired lesson page (or the learner) can run code there.
- **Eclair in the lab.** Eclair 0.12–0.13 crashed in its native secp256k1 library when signing channel messages under Docker Desktop on Windows, so Eclair runs as a fifth node (Erin) instead of Chan, as the book has it. Revisit when a fixed Eclair image is out.

- **JavaScript budget.** The spec asks for under 100 KB of compressed JavaScript per page. The React 19 and Next.js 16 runtime alone is about 130 KB gzip (pages measure about 141 KB gzip, about 120 KB brotli), so this stack can't meet the target. CI enforces a 150 KB ceiling to catch regressions. Deciding between accepting this and changing the framework is open.
- **Review.** All 16 lessons are drafts written for review. They have no `lastReviewed` date, so the reader shows a draft notice. Each needs a Kiswahili reviewer and a technical reviewer before launch.
- **Live URL.** `lib/site.ts` uses `https://jifunze.bitsacco.com` as a placeholder.
- **Kujifunza Bitcoin PDF.** The library links to `https://bitsacco.com/kujifunza-bitcoin-sw.pdf`, which goes live when bitsacco/bitsacco PR #107 merges.

## Licences

- Code: [MIT](LICENSE)
- Curriculum (`content/`): [CC BY-SA 4.0](content/LICENSE)
- Credits for adapted material: [ATTRIBUTIONS.md](ATTRIBUTIONS.md)
