# Mastering Bitcoin source and redistribution review

Checked 2026-11-05 for the anonymous public release. No book PDF was copied, purchased, generated, altered or redistributed.

## Decision

**No publicly downloadable official English third-edition PDF meeting the requested provenance standard was found in the official sources checked.** The open third-edition source is legitimately CC BY-SA 4.0, but a license grant and an authenticated PDF artifact are separate requirements. Jifunze therefore offers the official English online edition and clearly marks the Kiswahili PDF as awaiting official publication. Neither missing PDF blocks the educational release. No PDF viewer, document framework or new package is added.

## Edition and authoritative evidence

| Evidence | Finding |
| --- | --- |
| [Publisher catalogue](https://www.oreilly.com/library/view/mastering-bitcoin-3rd/9781098150082/) | *Mastering Bitcoin, 3rd Edition*, Andreas M. Antonopoulos and David A. Harding, O'Reilly Media; English; catalogue date November 2023; 402 catalogue pages; ISBN in the supplied publisher URL 9781098150082. This is catalogue pagination, not a verified PDF page count. |
| [Official project README](https://github.com/bitcoinbook/bitcoinbook/blob/275c4eb8eab8800c6adc39f8def8e8f8fa356a57/README.md) | Identifies the complete third edition, first print, December 2023; directs free readers to `BOOK.md`. |
| [Official LICENSE](https://github.com/bitcoinbook/bitcoinbook/blob/275c4eb8eab8800c6adc39f8def8e8f8fa356a57/LICENSE) | Explicitly applies CC BY-SA 4.0 to the third edition and states publisher approval of the open licenses. |
| [Harding's relicensing commit](https://github.com/bitcoinbook/bitcoinbook/commit/94c9ba64b454eb79ca77904a48251bd4efab73cf) | Dated 2024-12-26. Harding explains his contractual right to release under CC BY-SA after twelve months and identifies the US hard-copy publication date as 2023-12-12. The commit updates LICENSE/README and disables the obsolete README prohibition on making PDFs. |
| [Original third-edition release](https://github.com/bitcoinbook/bitcoinbook/releases/tag/third_edition_print1) | Published 2024-01-28 with the earlier CC BY-NC-ND wording. These historical notes predate the later explicit relicensing; they do not negate the subsequent grant. It has no downloadable release assets. |
| [Author's announcement](https://dtrt.org/posts/mb3e-announcement/) | Independently describes the third edition and the planned CC BY-SA release after the contractual waiting period. |

The current official `develop` commit is `275c4eb8eab8800c6adc39f8def8e8f8fa356a57`. Its complete recursive tree was not truncated and contained zero PDFs and zero build workflows. All four GitHub releases had zero attached assets; the auto-generated source archives are not PDFs. The other official branch is `mb3dev`, an earlier development branch, not an authenticated publication channel for a finished PDF. The authors' sites and publisher catalogue did not provide a qualifying free English third-edition PDF. The author's shop result offering PDF/EPUB/MOBI is explicitly the **second edition**, which was rejected as a substitute. Community PDF proposals and arbitrary third-party files were not used.

## Redistribution conditions

The [CC BY-SA 4.0 terms](https://creativecommons.org/licenses/by-sa/4.0/) allow sharing the licensed material, including local hosting and downloads, subject to attribution, retaining supplied notices, a license link, identifying changes when made, and avoiding additional legal or technological restrictions. Adaptations must use the required same/compatible license. This does not establish that any particular third-party file is authentic or that separate publisher artwork/packaging is included. No purchased publisher PDF was obtained or distributed. A future integration must verify the actual file and its notices before copying it.

PDF URL, binary size, SHA-256, PDF page count, page rendering and document-completeness checks are **not applicable: no qualifying PDF was obtained**. No checksum is invented and no unofficial PDF is manufactured. For the online fallback, `BOOK.md` at the pinned official commit lists the preface, fourteen chapters and three appendices; the linked source paths exist in the official tree. Its file is 1,034 bytes, Git blob ID `9552c8fc71f7e34343de7d11d9174190126da379` (a Git object identifier, not a PDF SHA-256).

## Learner experience and availability

- English: bilingual library entry names the authors, third edition, 2023 and CC BY-SA 4.0. A plain link opens the pinned official online table of contents. It intentionally leaves Jifunze only when selected; it is not advertised as an in-app PDF or download.
- Kiswahili: approved title, author, translator credit and description remain. The download URL and unverified download size are removed from the pending entry. Both languages explain that the PDF awaits official publication. [Bitsacco PR #107](https://github.com/bitsacco/bitsacco/pull/107) remains OPEN with no merge commit. Its file was not copied or represented as published.
- Existing Bitcoin whitepaper links are preserved. Future authorized PDFs can reuse this library entry point; a reader is deferred until an actual approved artifact exists.
- No document downloads or remote-reader assets are requested on library load. All new library markup is server-rendered. Existing learning, accounts-unavailable behavior, static API rejection and service-worker policy remain intact.

## Verification and publication

Final source commit, browser counts, performance measurements, Draft PR and CI results are recorded in the final release-review report. Schema regressions ensure available PDFs still require a file size, available resources require a URL, and pending PDFs cannot advertise a URL. Browser checks cover both languages, desktop/mobile layout, author/license/edition metadata, keyboard access, no automatic PDF download, no pending download link and WCAG serious/critical violations.

PDF response MIME, embedded page navigation, PDF download integrity, interrupted PDF loads and in-app PDF rendering are not claimed or marked passed: the conditional PDF integration was not performed. The source is available online; the absence of an authenticated PDF is a documented enhancement limitation, not a launch blocker.
