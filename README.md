# Bitsacco Jifunze

A free, Kiswahili-first Bitcoin learning platform with two roadmaps:

- **Bitcoin kwa Wawekaji** (Bitcoin for Savers), for Bitsacco members, chama groups and anyone new to Bitcoin.
- **Bitcoin kwa Wajenzi** (Bitcoin for Builders), for developers building on Bitcoin, Lightning and Fedimint.

Every lesson ships in Kiswahili and English. There are no accounts and no backend: the site is a static export. Progress lives in the reader's browser and can be exported to a file and imported on another phone. Lessons opened once stay readable offline.

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
```

`npm run build` runs `scripts/postbuild.ts` after `next build`. It:

- adds a per-page Content Security Policy with hashes of that page's inline scripts;
- stamps the service worker with the build ID;
- fails on any broken internal link;
- fails if the first lesson page is over **200 KB** gzip, or if any page's JavaScript is over **150 KB** gzip. It also warns above the spec's 100 KB target; see "Known gaps" below.

## Run the container

```bash
docker build -t jifunze .
docker run --rm -p 8080:8080 jifunze   # http://localhost:8080/sw/
```

The image serves plain files from `nginxinc/nginx-unprivileged` as a non-root user. There is no app server, database or secret.

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
docker/                nginx config and security headers
```

## Known gaps

- **JavaScript budget.** The spec asks for under 100 KB of compressed JavaScript per page. The React 19 and Next.js 16 runtime alone is about 130 KB gzip (pages measure about 141 KB gzip, about 120 KB brotli), so this stack can't meet the target. CI enforces a 150 KB ceiling to catch regressions. Deciding between accepting this and changing the framework is open.
- **Review.** All 16 lessons are drafts written for review. They have no `lastReviewed` date, so the reader shows a draft notice. Each needs a Kiswahili reviewer and a technical reviewer before launch.
- **Live URL.** `lib/site.ts` uses `https://jifunze.bitsacco.com` as a placeholder.
- **Kujifunza Bitcoin PDF.** The library links to `https://bitsacco.com/kujifunza-bitcoin-sw.pdf`, which goes live when bitsacco/bitsacco PR #107 merges.

## Licences

- Code: [MIT](LICENSE)
- Curriculum (`content/`): [CC BY-SA 4.0](content/LICENSE)
- Credits for adapted material: [ATTRIBUTIONS.md](ATTRIBUTIONS.md)
