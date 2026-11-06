# Public education release: final review record

> **Historical online-only candidate review, 2026-11-05.** This predates the generated English PDF and merged production release. For the current resource see [PDF provenance](mastering-bitcoin-generated.md); for deployment and live acceptance see [production operations](production.md). Counts and pending gates below apply to the recorded earlier commits.

This is preparation and Draft PR publication, not production deployment or live public-domain acceptance. Production remains `https://bitsaccojifunze.xyz`; staging remains `https://staging.bitsaccojifunze.xyz`. No www domain, Railway resource, billing change, DNS change or live authentication activation is included.

## Source and book decision

The clean starting branch `release/public-education` matched documentation HEAD `c1ad5ffccd26f6d55e2b9b86edca158d2ed10e13`, including implementation `7a6f74d89289f0d95c06cffecf7102bb3e6e5fd8`. Its three release commits had valid SSH signatures. Main remained `21a7c48edcf8244aa0513aef322faf11cda87541`.

New implementation commit: `b779a9b3a68d33a87306b4f74e1ee005cf5596a4` — official English online fallback, pending Kiswahili availability, resource validation, browser/unit coverage and source research. Test-only correction: `66f815530d27e69c5abb7512afebc63dcb454d72` — wait for hydrated simulation controls before exercising keyboard focus. Both are SSH-signed; no history was rewritten and no attribution trailers were added. This final record is a subsequent documentation-only commit. The published HEAD and CI run links are recorded in the Draft PR description after inspection.

**No qualifying official English third-edition PDF was found.** The official source's CC BY-SA 4.0 grant is verified: co-author David Harding relicensed it on 2024-12-26 after the publisher's contractual waiting period. Older release notes contain the initial CC BY-NC-ND grant. The detailed [source review](mastering-bitcoin-sources.md) supplies authoritative links, the chronology, publisher details and redistribution conditions. This is an artifact-provenance limitation; the current open-source license permits redistribution of its licensed material under its conditions.

No purchased or third-party PDF was copied; no unofficial PDF was generated; no second edition was substituted. PDF size, PDF SHA-256, complete-document rendering, `application/pdf` response, embedded navigation, download integrity and interrupted PDF-load tests are not applicable to a nonexistent approved artifact and are not claimed as passes. No reader framework or unused reader implementation was added.

| Resource | Current experience |
| --- | --- |
| English *Mastering Bitcoin*, third edition (2023) | Library entry identifies both authors and CC BY-SA 4.0. Explicit plain link opens the pinned official project's online table of contents. It leaves Jifunze only when selected; it is not represented as in-app PDF reading. Official URL returned 200 without a redirect; all eighteen preface/chapter/appendix targets exist. |
| Kiswahili *Kujifunza Bitcoin* | Approved title, description and translator credit retained. Clearly marked as awaiting official publication; no broken download URL or unverified file size advertised. Bitsacco PR #107 remains open; its PDF was not copied. |
| Existing English/Kiswahili whitepapers | Preserved. Both official Bitsacco URLs returned 200, `application/pdf`, with exact existing sizes 184,292 / 908,278 bytes. |

Neither missing book PDF blocks the initial learning release. A future approved artifact can use the same library entry point and a single shared reading experience.

## Final packaged export and local checks

Application image source: `b779a9b3a68d33a87306b4f74e1ee005cf5596a4`. Test-harness correction `66f8155` changes no application files. Runner image ID: `sha256:116cfe83909c47c02ed8cac9e1e37cff72c2ef9501d993895c17a1b6b54799ab`; export build ID `d6BOqpmpnCR0Lyg0TcCHP`. Tests used the actual root-Dockerfile runner and its extracted matching export. Build/check runtime: Node 24.22.2, npm 12.0.2. Native Playwright runs on the workstation's Node 24.19.0 and serves no application code. Heavy checks ran sequentially; browsers used one worker and NGINX was capped at 96 MiB / 0.25 vCPU.

| Check | Result |
| --- | --- |
| Production build, CSP and internal links | Passed; 110 HTML pages |
| Lint and type checking | Passed in the build container |
| Unit tests | 152 passed across 29 files |
| English/Kiswahili content validation | 0 errors; 69 existing metadata/terminology warnings; approved lesson text unchanged |
| SEO/export audit | Passed; all 94 indexable pages retain canonical, Open Graph and matching language URLs; no staging/backend origin or common secret patterns in export |
| Static-only NGINX checks | 239 passed; all API/auth routes blocked, no sessions, appropriate headers and fail-closed configuration |
| Existing staging proxy contract | 97 synthetic Docker checks passed; no live staging authentication enabled |
| Desktop full run | 106 passed, 8 intentional skips, 1 diagnosed test-readiness failure; all new library cases passed |
| Corrected keyboard scenarios | 20/20 passed: both simulations and languages, repeated five times, with all downstream keyboard/focus/storage assertions retained |
| Mobile full run | 63 passed, 52 intentional skips, 0 failures/flaky tests (3.9 minutes) |

The initial desktop failure was investigated, not dismissed: its retained trace shows `disabled=""` on the Start button at the first focus attempt. `page.goto` load completion precedes React readiness. The test now waits for an enabled button and confirms button focus before Enter. The application's deliberate no-JavaScript/hydration behavior is unchanged. The original heading-focus, interaction, conservation/reset and no-network-write checks remain. The published-HEAD CI runs the complete corrected suites; its disposition belongs to the PR's CI record.

Library checks cover both languages, author/license/source metadata, keyboard access, desktop/mobile overflow, WCAG serious/critical violations, no automatic PDF requests, a real online-reading action, and no pending translation download. Existing suites cover learning paths, lessons, trees, quizzes, simulations, navigation, unavailable accounts, local progress import/export, offline reading and accessibility. Local logs and the original failure trace are retained under ignored `.superpowers/book-release/`.

## Performance and isolation

No dependencies or client components were added; the new library states and metadata are server-rendered. No PDF is fetched before a learner chooses a resource. Existing thresholds are unchanged. Initial gzip JavaScript measurements match the prior container baseline at the displayed 0.01 KB precision: home 143.50 KB, roadmap/tree 143.70 KB, catalogue 142.39 KB, simulation 141.85 KB, lesson 146.09 KB and lab 152.12 KB. Actual activated simulation totals remain about 144.56 KB (UTXO) and 144.09 KB (channel balances), matching the prior packaged baseline. The existing documented 100 KB aspiration remains unmet by the React/Next runtime; enforced ceilings and UX budgets pass.

The browser-tested container had zero active API upstream/resolver/proxy-trust directives and zero backend/database/credential/trust environment variables. Anonymous learning, hidden account navigation, non-interactive account explanations and service-worker account/API exclusions are preserved. No production API or database is provisioned. The staging-only proxy trust exception is not enabled for authenticated production.

Before publication, staging configuration ETag remained `8f3a697a57105d8e9b93c5ce9fe823e46a2d68e4d9ae01879c3e70e55c2a4c77`; both services' auto-deploy remained disabled (`NO_INSTALLATION`). No Railway mutation was used. Publication targets only the dedicated release branch and a Draft PR; no merge or deployment is authorized.

## Remaining review and launch gates

The maintainer's completed Kiswahili review remains recorded. Missing historical review dates must not be presented as uncompleted language review. Technical content acceptance and review of the release changes remain maintainer gates. Production spending/provisioning/deployment authorization, maintainer-performed Namecheap DNS configuration and actual public-domain TLS/HTTPS/live acceptance remain separate future steps. GitHub/Nostr authentication acceptance and either book PDF are explicitly not launch prerequisites for this anonymous release.

The Draft PR description records the final published HEAD and observed CI results. A green CI result supports final release review; it does not authorize merging, provision infrastructure or establish live production acceptance.
