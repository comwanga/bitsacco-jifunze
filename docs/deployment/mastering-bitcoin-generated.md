# Generated English third-edition PDF

This local follow-up supersedes the online-only decision in `mastering-bitcoin-sources.md`. The maintainer subsequently authorized generating a PDF from verified official open-source material. It does not change the already published Draft PR until a separately approved push. No purchased, third-party or publisher-branded PDF is used.

## Source and permission

- Official source: https://github.com/bitcoinbook/bitcoinbook
- Exact revision: `275c4eb8eab8800c6adc39f8def8e8f8fa356a57` (2024-12-26, third edition).
- Authors: Andreas M. Antonopoulos and David A. Harding.
- Title: *Mastering Bitcoin: Programming the Open Blockchain*, third edition, O'Reilly Media, 2023. Publisher catalogue: https://www.oreilly.com/library/view/mastering-bitcoin-3rd/9781098150082/ . The generated pagination differs from the publisher edition.
- [Pinned upstream LICENSE](https://github.com/bitcoinbook/bitcoinbook/blob/275c4eb8eab8800c6adc39f8def8e8f8fa356a57/LICENSE) grants CC BY-SA 4.0 for the third edition. [Harding's relicensing commit](https://github.com/bitcoinbook/bitcoinbook/commit/94c9ba64b454eb79ca77904a48251bd4efab73cf) explicitly exercises his publisher-contract right after twelve months from the first US hard-copy release (2023-12-12). Historical January 2024 CC BY-NC-ND release notes predate that grant; they do not override the later revision's express permission.
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) allows generating, locally hosting, reading and downloading the licensed material with attribution, retained notices, a license link, identified changes, and ShareAlike for adaptations, without additional restrictions. Those notices are in the PDF and its adjacent source manifest. The generated edition is offered under CC BY-SA 4.0, with the identified separate notices retained.

Asset review: the work's root grant covers its included illustrations absent separate exclusions. Original figure credits remain (including Eric Lombrozo's Bitcoin Core architecture and BIP 68). Wallet illustrations identify the Bitcoin Design Guide, whose [official license](https://github.com/BitcoinDesign/Guide/blob/master/LICENSE) permits guide material under CC BY 4.0; that attribution is also retained. Appendix A retains Satoshi Nakamoto's full MIT whitepaper notice; appendix B retains its CC0 errata dedication. No conflicting body-asset notice was found. Original publication/copyright information and colophon are retained as historical notices, with the later grant explained. Publisher animal cover, logos, proprietary fonts and trade dress are not reproduced. DejaVu/Bitstream/Math TeX Gyre fonts are embedded with their complete redistribution notices (`scripts/books/font-notices.txt`, obtained from the official DejaVu project LICENSE).

## Generation

The source has raw HTML tables and MathML, so a direct Asciidoctor PDF conversion would lose material. Use upstream `book.adoc` with standard Asciidoctor HTML5 and its documented MathJax publishing approach, then Chromium's tagged PDF printing. An initial mathematical-extension trial was rejected because it misrendered TeX operators (`\\mod` and `\\text`); the retained MathJax output is checked visually. No custom content parser, rewritten book, rasterized text or application PDF framework is introduced. Upstream Atlas relies on proprietary O'Reilly/AntennaHouse tooling and artwork; it cannot be reproduced here unchanged.

`scripts/books/generate-mastering-bitcoin.mjs` checks the clean pinned clone, processes the original assembly (preface, 14 chapters, 3 appendices), and includes original title, praise, copyright, dedication, author biographies and colophon. It adds a plain provenance notice, open-font print styles, a linked TOC, exact-location index links and bookmarks. Mathematical renders are vector SVG (12 block equations and 1 inline expression) and native MathML (5). The converter's redundant inline TeX delimiters are unwrapped; only four index macros inside HTML passthrough are processed using Asciidoctor's own macro substitution. No source prose, code or illustrations are edited. Long code lines wrap rather than clip; original examples remain searchable text. Page numbers are continuous. Source paragraphs and code are compared independently after whitespace normalization, with the inline formula checked separately, without claiming byte equivalence with AsciiDoc or equivalence to the publisher PDF.

Reproduction prerequisites: Docker, the existing npm lockfile/Playwright Chromium, Python with PyMuPDF 1.26.7 and pypdf 6.2.0 for independent checks. Publishing-only Python tools are not application dependencies. Clone the official repository at the exact revision into ignored `.superpowers/mastering-bitcoin-upstream`. Download the official MathJax 3.2.2 `es5/tex-svg.js` bundle to `.superpowers/pdf-generation/tex-svg.js` from `https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js`; its SHA-256 is checked by the generator (`d4295dc33744836935c1399feece5159577b34c5c8ffb9f1c6324cd82e03a882`). Its Apache 2.0 notice is retained in the PDF (`scripts/books/mathjax-LICENSE.txt`). The generator copies open fonts from the pinned image; no network is permitted during conversion or printing. Then run:

```
node scripts/books/generate-mastering-bitcoin.mjs
python scripts/books/verify-mastering-bitcoin.py
```

Publishing image: `asciidoctor/docker-asciidoctor@sha256:b0c0ebff6e2d6f5cd66a075310ca7f076921d8acb293d8f4ae8fcae0d7fea30c`; Asciidoctor 2.0.26; MathJax 3.2.2; Chromium 156.0.8078.4. PDF metadata is recorded without resampling images. Chromium already compresses streams and subsets fonts. Creation timestamps can differ on regeneration: the checked-in artifact and manifest are the release identity.

## Artifact and content verification

`public/books/mastering-bitcoin-en-3rd-edition.pdf`

- 9,421,967 bytes (8.99 MiB); 420 pages; SHA-256 `138bd9c4314e8013da2036286003a0d323f3866153129bc5d421c4df14a03650`.
- 343 bookmarks and 2,292 link annotations; no out-of-range internal link destinations.
- All 19 major source headings present in order: preface, 14 chapters, appendices A–C and index. All 1,695 parsed source paragraphs and 171 listing blocks found in extracted PDF text after whitespace normalization; zero missing. The HTML contains 115 tables (including structural admonition tables) and 79 images; every image loads and all 79 image occurrences are present in the PDF. Mathematical blocks are vector content rather than image occurrences.
- All 679 parsed table cells are present after whitespace normalization. A separate 6,393-window text comparison leaves 19 boundary windows across numbered lists/tables and vector formula boundaries where PDF list markers/repeated table headers and mathematical text extraction alter extraction order. Their constituent paragraphs, table cells and code are present; these are extraction-order differences, not omitted source sections.
- Independent PyMuPDF and pypdf reopen the PDF successfully. Tagged structure exists; no encryption, JavaScript, open actions, unexpected blank pages or text outside page bounds. Only embedded DejaVu font families are used.
- Every page rasterized and inspected in contact sheets, with enlarged checks of attribution, code, equations, tables and figures. Contact sheets and audit JSON remain in ignored `.superpowers/pdf-generation/`. No missing diagram, clipped code or unreadable replacement glyph was observed.

Limitations: fixed-layout pages require zoom on small screens; native PDF controls and assistive-technology support vary by browser. Tagged output is not a PDF/UA certification. The original raw MathML and converted vector formulas need native reader support; the unchanged source remains linked for an alternative accessible representation. The generated index uses linked occurrence numbers rather than publisher page references.

## Application integration and release safety

The existing bilingual library links one shared reader at `/{lang}/library/mastering-bitcoin-en/` and a same-origin download. Reader copy explains the generated edition and credits both authors, the exact source and license. Native browser reading provides page/search/zoom controls; direct same-site open/download links remain available, including without JavaScript and on browsers without embedding support. There is no external reader redirect.

Read is explicit and disabled until hydration. One same-origin fetch verifies MIME, signature, length and SHA-256; a blob is reused by the native iframe and subsequent download. Loading, cancellation, retry, HTTP/type/integrity/interruption failures are handled. Blob URLs are revoked on unmount. Only reader pages permit blob frames; the existing `object-src 'none'`, frame-ancestor and other security headers remain. No new npm package, backend, credentials or database is needed.

The service worker bypasses `/books/` even for direct navigations: the entire book is neither precached nor saved in lesson caches. Ordinary learning/library/reader-page visits do not fetch the PDF. Explicit downloads can be kept by learners independently of lesson caching. The build verifies the artifact against its manifest; a truncated or replaced file fails the build.

Kiswahili publication remains pending [Bitsacco PR #107](https://github.com/bitsacco/bitsacco/pull/107). No unmerged PDF is copied or advertised. The same reader can be reused after a verified publication. Previously reviewed Swahili educational content, anonymous accounts-unavailable behavior, static API rejection and staging isolation remain unchanged.

Final source SHA, packaged-build/browser results and remaining authorization are recorded in the integration review report after verification. No new push, merge, deployment, Railway/DNS/billing change is authorized by this local integration.
