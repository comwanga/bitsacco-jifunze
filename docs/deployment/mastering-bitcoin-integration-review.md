# English Mastering Bitcoin integration: local review

This follow-up is local preparation, not publication or deployment. Branch: `release/public-education`. Production remains `https://bitsaccojifunze.xyz`; staging remains `https://staging.bitsaccojifunze.xyz`; no www domain. Main remains `21a7c48edcf8244aa0513aef322faf11cda87541`. The starting release HEAD was `57d215d7a88c367205cf68e34b338d847f787302`.

## A. Source verification

The English third-edition source is the official [bitcoinbook repository](https://github.com/bitcoinbook/bitcoinbook), pinned at `275c4eb8eab8800c6adc39f8def8e8f8fa356a57`. It identifies Andreas M. Antonopoulos and David A. Harding as authors. The publisher's [third-edition catalogue](https://www.oreilly.com/library/view/mastering-bitcoin-3rd/9781098150082/) corroborates the edition and 2023 publication.

Redistribution is permitted by the pinned LICENSE's CC BY-SA 4.0 grant. [Harding's 2024-12-26 relicensing commit](https://github.com/bitcoinbook/bitcoinbook/commit/94c9ba64b454eb79ca77904a48251bd4efab73cf) explicitly exercises his publisher-contract right after twelve months from the first US hard-copy publication. The older CC BY-NC-ND release notes predate this grant. This resolves the discrepancy for the selected revision; it does not authorize copying a purchased publisher PDF.

The generated document retains author/copyright credits, source/revision, the current license link, original publication information and a notice identifying typesetting/index/bookmark changes. It clearly says it is generated from official open-source text and is not the publisher's official PDF. Separate MIT whitepaper, CC0 errata, CC BY Bitcoin Design Guide image credits and font/MathJax notices are retained. Publisher cover, logos, proprietary fonts and trade dress are excluded. See [full provenance, asset review and reproduction](mastering-bitcoin-generated.md).

## B. PDF generation and completeness

- File: `public/books/mastering-bitcoin-en-3rd-edition.pdf`.
- Size: **9,112,090 bytes** (8.69 MiB); **406 pages**.
- SHA-256: `aedbf60fc15e199903d3bfede1268dae4aa75922f764fb44b1d400eb0d255511`.
- Method: upstream `book.adoc`, standard Asciidoctor HTML5, pinned MathJax for TeX, then Chromium tagged PDF printing with open embedded fonts. No application PDF framework or npm dependency was added.
- Complete preface, fourteen chapters, appendices A–C, source front/back matter, author credits and index. All nineteen major headings occur in order. All **1,695 source paragraphs**, **171 code listings** and **679 table cells** are present after whitespace normalization; the inline equation is verified separately. All **79 image occurrences** render; 13 TeX expressions and 5 native MathML expressions are retained.
- **343 bookmarks**, **2,292 link annotations** (2,193 internal named links and 99 external URI links), all 1,954 named destinations resolved to valid pages, and every bookmark in range. No invalid internal destinations, unsafe URI/launch actions, unexpected blank pages or text outside page bounds. Independent PyMuPDF/pypdf reopening succeeds; no encryption, JavaScript or open actions. Every page was rasterized and inspected, with enlarged code, figure, formula and notice checks. The strengthened audit rerun preserved the exact packaged checksum.
- The broader 5,979-window comparison leaves 19 extraction-boundary differences across list counters, repeated table headers and vector formulas. Constituent prose, code and table cells are present; this is not a claim of byte equivalence with source or the publisher's PDF.

An early renderer's incorrect TeX operators were caught visually and replaced with MathJax. Duplicate inline delimiters and source index publishing markers are handled as typesetting, with no rewriting of mathematical tokens or book prose. Final index entries omit Atlas IDs/sort hints and preserve labelled see/see-also references. Long code lines wrap. Fixed page layouts require zoom on small screens; vector math may have reader-dependent text-search/accessibility behavior. Tagged output is not PDF/UA certification.

## C. Jifunze reading experience

The existing bilingual library links to `/{lang}/library/mastering-bitcoin-en/`. A small shared native reader loads only after **Read PDF** is selected; there is no automatic book request from ordinary learning, library or reader-page visits. One fetch checks MIME, signature, length and SHA-256, then reuses the verified blob for the iframe and download. No duplicate network download is needed after reading. Loading, cancel, retry, HTTP/type/integrity/truncation/interruption errors and accessible download/open fallbacks are provided. Native controls offer page navigation, search and zoom where supported. The page and PDF remain on Jifunze.

Only reader pages allow blob frames. Existing object/frame-ancestor protections remain. `/books/` bypasses the service worker, including navigations; the PDF is neither precached nor stored in lesson caches. Existing local learning progress, export/import and offline lessons remain independent. No API, database, secrets or staging connection is introduced.

[Bitsacco PR #107](https://github.com/bitsacco/bitsacco/pull/107) is still open and unmerged. The Kiswahili title/credits remain, clearly pending with no download URL. No translation PDF is copied; publication can later use the same reader. The maintainer's review of the existing Swahili educational content is accepted.

## D. Verification against the final package

Packaged application/source commit: **`cd2ebd05daa1fe3bd485e7ee61ebbd0ac3e5152d`**. Subsequent review documentation and publishing-audit checks do not alter the application or PDF. Node **24.22.2**, npm **12.0.2**. Final NGINX image: `sha256:ebd3d9a48d17d7262a5d1fd2ac54d9cdd8776d17e4d8bd1e5f8c59a7a88d7b37`. Browser suites use that actual image at localhost, with production canonical metadata. Heavy checks run sequentially with one browser/unit worker.

| Check | Result |
| --- | --- |
| Lint / TypeScript | Passed |
| Unit tests | 155 passed, 30 files |
| Production build / internal links / CSP | Passed; 112 HTML pages |
| English/Kiswahili content validation | 0 errors; 69 pre-existing review-date warnings |
| SEO / sitemap / source and credential scan | Passed; 96 indexable pages with matching canonical/Open Graph/language alternatives; 703 export files |
| Production static/API/header/PDF range checks | 242 passed; all tested API/auth methods fail closed, no sessions or backend/proxy dependency |
| JavaScript budgets | Passed without changing thresholds; ordinary pages retain previous sizes; reader 142.92 KiB gzip JS, below 150 KiB |
| Desktop / mobile | Desktop: 115 passed, 8 project-specific skips; mobile: 71 passed, 52 project-specific skips; 0 failures or flaky tests |
| Accessibility | Reader controls: zero Axe violations; representative learning pages and simulations: no serious/critical violations in the existing bilingual/light/dark checks; keyboard/download fallbacks passed |
| Native PDF reading and navigation | Full Chromium rendered the final book and navigated to page 82; active service worker; no book cache entries or console errors. Pixel 5 emulation in full Chromium also rendered the native viewer, with zero page overflow and a successful checksum-verified download |
| Staging build / proxy compatibility | Local staging build passed: 112 noindex pages, 288 correct staging sitemap/language URLs, robots disallow all; existing NGINX startup test passed; 97 synthetic proxy regressions passed (not a claim of live ingress acceptance) |

The browser coverage includes both languages, navigation/lessons, mobile layout, simulations, offline learning, progress import/export, accessibility, unavailable accounts, deliberate local-lab connection, PDF MIME/download checksum, no automatic/duplicate book request, cancellation and failed/interrupted loads. Reader accessibility checks exclude the browser-owned PDF plugin while testing the application controls; the document is independently rendered and native reading is checked separately. Phone coverage is Chromium device emulation, not a physical Safari/Android-reader certification.

Two new-test defects were corrected without weakening assertions or changing working application behavior: Node required a JSON import attribute; global `role=alert` selectors also matched Next.js's route announcer. The final assertions target the reader region. An earlier complete desktop run passed 115 with 8 project-specific skips before the index-only publishing correction; the final-package results above supersede it.

Read-only Railway checks confirm only the existing staging environment, three existing services and no repo triggers. Web deployment `4549aec0-324e-4032-9c57-306ceef68c79`, API `7ad5f149-4785-4461-8365-13a64fadecd7`, and PostgreSQL `f8ac6eaf-5174-4157-9064-8304c295fe4e` remain unchanged with SUCCESS status. No variables, tester entries, database data, billing, DNS or deployment configuration were modified.

## E. Changes, history and next approval

Local SSH-signed commits, preserving all existing history:

1. `75d28c6cda89e1a3a5667333bb11b88aade799ac` — generated book, attribution, reader, build integrity checks and regressions.
2. `a52a70f87c6ba1b018c8c47cefc2e93b93fac1f1` — required Node JSON-import attribute and validation-comment clarification.
3. `8a42c536442a9722f9c3d50c4ef49ceba331ceec` — reader-scoped error assertions.
4. `cd2ebd05daa1fe3bd485e7ee61ebbd0ac3e5152d` — clean index publishing markers and final verified binary/manifest.
5. A subsequent verification/report commit records this review and strengthens named-destination checks without changing the application or PDF.

Changed file groups: `public/books/` (PDF/provenance); `components/books/BookReader.tsx`; `app/[lang]/library/{page.tsx,mastering-bitcoin-en/page.tsx}`; `content/library.json`; `lib/build/{book,csp}.ts`; `lib/content/{routes,validate}.ts`; `public/sw.js`; `scripts/{postbuild.ts,serve-out.mjs,check-public-runtime.mjs}`; `scripts/books/` (six publishing/style/license/verification files); `e2e/{book,library}.spec.ts`; `tests/build/{book,metadata,postbuild}.test.ts`; `tests/pwa/sw.test.ts`; and the three book source/generation/review documents under `docs/deployment/`. No package or lockfile change, authentication implementation change or unrelated educational edit is included.

Existing Draft PR: **https://github.com/comwanga/bitsacco-jifunze/pull/10**. Its published HEAD remains `57d215d7a88c367205cf68e34b338d847f787302`; both published CI runs (`42108479272`, `42108466758`) have successful check/account/lab jobs. These local PDF commits have **not been pushed**, so GitHub CI has not run on them. No merge or deployment is claimed.

Next authorization: approve pushing these signed local commits to the existing Draft PR and inspecting CI on the resulting HEAD. Production resource expenditure, deployment and maintainer-performed Namecheap DNS changes remain separate approvals. No public-domain acceptance is claimed. The pending Kiswahili PDF does not block this educational release.

No unresolved product regression or PDF redistribution blocker was found. Local preview: `http://localhost:4324/en/library/mastering-bitcoin-en/` (localhost-only NGINX review container; no public deployment).

**READY FOR REVIEW**
