# Generated Kiswahili third-edition PDF

*Kujifunza Bitcoin: Kuprogramu Blockchain Huria* (Toleo la 3) is comwanga's Kiswahili translation of *Mastering Bitcoin: Programming the Open Blockchain*, third edition, by Andreas M. Antonopoulos and David A. Harding. Jifunze publishes a PDF generated from the translation's open-source text with the same pipeline as the [English edition](mastering-bitcoin-generated.md). It is not a publisher's PDF.

## Source and permission

- Translation: https://github.com/comwanga/bitcoinbook-swahili at revision `5da7e1705b29c153ef2d7ed040df8a8b6a6eed53`. Its LICENSE licenses the translation under CC BY-SA 4.0.
- Original text and illustrations: https://github.com/bitcoinbook/bitcoinbook at `275c4eb8eab8800c6adc39f8def8e8f8fa356a57`. The translation's chapters translate the tag `third_edition_print1`; the pinned revision is that tag plus the two commits that changed only `LICENSE` and `README.md` (the CC BY-SA grant). Illustrations are used unchanged from it, so their labels are in English.
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) covers both the third edition and the translation. The PDF's first pages state the translator, both source revisions, the licence and the changes, and reproduce the translation and upstream licence notices. The separate whitepaper (MIT), errata (CC0), Bitcoin Design Guide (CC BY 4.0), font and MathJax notices are retained, as in the English edition.
- The cover is comwanga's own illustration and design, licensed CC BY-SA 4.0 and kept at `scripts/books/kujifunza-bitcoin-cover.png` (pinned by SHA-256 in the generator) and as `swahili/images/cover_swahili.png` in the translation repository. An earlier version carried the O'Reilly logo, a trademark CC BY-SA does not license; the logo was removed (filled with the surrounding background, nothing else changed) and the notice page states that no publisher endorsement is implied. Publisher cover, logo and trade dress are not reproduced.

An earlier Kiswahili PDF, made with Asciidoctor PDF directly, printed the source's raw HTML tables and MathML as code (31 tables and 13 formulas across about 89 pages), had "Huriahii" in its title and stated no licence. This edition replaces it; it is not published anywhere by Jifunze.

## Generation

Prerequisites match the English edition: Docker, the npm lockfile's Playwright Chromium, the checksum-verified MathJax 3.2.2 bundle at `.superpowers/pdf-generation/tex-svg.js`, and the pinned upstream clone at `.superpowers/mastering-bitcoin-upstream`. Clone the translation into ignored `.superpowers/bitcoinbook-swahili` at the revision above, then run:

```
node scripts/books/generate-kujifunza-bitcoin.mjs
python scripts/books/verify-mastering-bitcoin.py sw
```

The generator refuses a dirty or different revision of either repository, a missing CC BY-SA licence, or an unexpected book title. Asciidoctor runs in the same pinned, network-isolated image as the English edition, with the translation's `swahili/` directory and the upstream images mounted where `book.adoc`'s `imagesdir` expects them. Chromium prints the PDF; the verifier records metadata, checks it independently and writes contact sheets to `.superpowers/pdf-generation-sw/`.

## Artifact and content verification

`public/books/kujifunza-bitcoin-sw-3rd-edition.pdf`, identified by its [source manifest](../../public/books/kujifunza-bitcoin-sw-3rd-edition.source.json):

- 10,154,755 bytes; 422 pages; SHA-256 `3b99ac777bc8e59c15d9d163ef3a589228459be2d8bc2b6f74aa4b2b873f5ce4`. The build fails if the file does not match.
- Same structure as the English edition: 19 major headings in order, 115 tables, 79 book images plus the cover, 13 vector equations and 5 MathML formulas, 343 bookmarks. All 1,695 parsed paragraphs, 171 listing blocks and 679 table cells are present in the extracted PDF text; none is missing. No source markup is visible as text, and every internal reference resolves.
- 23 text windows are flagged for manual review, all at formula, list or table boundaries where extraction order differs (the English edition has 19 of the same kind); their paragraphs, cells and code are confirmed present by the checks above.
- PyMuPDF and pypdf reopen it; it is tagged, unencrypted, and has no JavaScript, open action, launch action, blank page or text outside page bounds. Every page was rasterized and inspected on contact sheets.

Limitations: 25 cross-references to raw-HTML tables print as their identifiers (for example `[table_4-12]`), exactly as in the English edition, because Asciidoctor cannot title those tables. The index has 1,643 entries; some terms are in Kiswahili and some remain in English, following the translation source. The other limitations of the English edition apply too.

## Application integration

The library links the reader at `/{lang}/library/kujifunza-bitcoin/` and a same-origin download. The reader is the English edition's component: one explicit, checksum-verified load, no automatic fetch and no offline caching of `/books/`. All 30 lesson references to the book (15 lessons, two languages) open that page.

Bitsacco [PR #107](https://github.com/bitsacco/bitsacco/pull/107) added a copy of the earlier PDF to bitsacco.com's repository; Jifunze does not link to it.
