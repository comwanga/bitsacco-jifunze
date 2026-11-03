# Phase 3 investigations (2026-11-04)

These are throwaway investigations run before any Phase 3 application code. None of this code ships. It is kept here so the findings in the [Phase 3 design](../../specs/2026-11-04-phase-3-design.md) can be checked and rerun.

## 1. Nostr login verification (`nostr/`): 26/26 passed

`verify.mjs` holds two things:
- A NIP-01 canonical serializer. It escapes exactly `\n " \\ \r \t \b \f` and keeps every other character verbatim.
- A NIP-98 login verifier with distinct error codes.

`run.mjs` tests them against:

| Check | Result |
|---|---|
| BIP-340 official test vectors (`bitcoin/bips/bip-0340/test-vectors.csv`) through `@noble/curves` 2.4.0 `schnorr.verify` | 19/19 agree with the expected result |
| 200 real events from `wss://relay.damus.io` and `wss://nos.lol`: id recomputed with the NIP-01 serializer | 200/200 (102 had escaped characters in their content) |
| The same 200 events: Schnorr signatures | 200/200 valid |
| Serializer keeps U+0001 verbatim, where `JSON.stringify` would escape it | pass |
| A correct NIP-98 login | accepted |
| Rejections (19 cases) | Replay; wrong kind; non-empty content; tampered `created_at`; forged signature; another key's signature; ±61 s skew; another site's URL; extra query string; duplicate `u`; method `GET`; payload hash for another body; unknown, expired, other-browser or wrong-nonce challenge; malformed header; missing header; uppercase hex. Each is rejected with its specific code |
| 20 concurrent submissions of one valid login against PostgreSQL 16 (`update … where used_at is null … returning`) | exactly 1 accepted, 19 rejected |

To rerun:

```sh
cd nostr
npm install
curl -fsSL https://raw.githubusercontent.com/bitcoin/bips/master/bip-0340/test-vectors.csv -o vectors/bip340.csv
docker run -d --rm --name jifunze-spike-pg -e POSTGRES_PASSWORD=spike-only -e POSTGRES_DB=spike \
  -p 127.0.0.1:55432:5432 postgres:16-alpine
node run.mjs
docker stop jifunze-spike-pg
```

## 2. Service worker and removed pages (`service-worker/stale-cache.mjs`)

Against a copy of the current build, the test opens `/en/glossary/`, deletes it from the server and reloads:

```json
{"cachedBefore":true,"onlineStatusAfterRemoval":404,"stillCachedAfterOnline404":true,"offlineShows":"Bitcoin glossary"}
```

The current worker keeps a page after the server returns 404, and serves it offline. That's harmless for lessons, but a privacy problem for builder profiles. The design responds in three ways:
- Profiles are never in the page cache.
- Profile data comes only from `no-store` API responses.
- The worker drops cached pages that now return 404 or 410.

## 3. GitHub contribution data: read-only checks with the maintainer's own `gh` token, public data only

- **Search items** carry `pull_request.merged_at`, but **not** a repository id, only `repository_url`. Stable repo ids need one cached `GET /repos/{owner}/{repo}` per repository.
- **Sample account:** `is:pr author:` gave 314 PRs, `is:merged` gave 286, and `-user:` (outside the account's own repos) gave 36.
- **One merged `bitcoin/bitcoin` PR** had **54 review submissions by 8 reviewers**:
  - Up to 32 submissions came from a single reviewer.
  - The states were 6 APPROVED and 48 COMMENTED, and 38 of the COMMENTED submissions had an empty review body.
  - So submission counts are not a measure of review effort.
- **`reviewed-by:` returns unique PRs.** One reviewer had 4,549 in that repository, far beyond search's 1,000-result cap.
  - Three date slices returned 1,185, 1,654 and 1,710, summing exactly to 4,549.
  - Each slice is still above 1,000, so import must bisect date ranges until every slice is below the cap.
- **Search rate limit:** 30 requests per minute.

## 4. Installation-token coverage (`github-app/installation-search.mjs`): not yet run

This needs a **test GitHub App** that has no permissions and is installed on the maintainer's personal account (decision D4). The script:
- mints an installation token (an RS256 JWT through Node's built-in `crypto`, no dependencies);
- runs the same public queries with that token and with the reference `gh` token;
- prints SAME or DIFF for each.

It is read-only and never prints keys or tokens. See the header of the script for usage.

## 5. Measured during the investigation (not kept as code)

- **Cross-language catalogue search.** Searching both languages' titles and descriptions makes:
  - "pochi" on `/en/learn/` find the wallets lesson (and 3 more);
  - "seed phrase" on `/sw/learn/` find the wallets lesson;
  - "chaneli" and "funguo" work as well.

  Cost: +2.5 KB of gzip HTML on the catalogue page; the client bundle is unchanged.
- **A static, server-rendered "Account" header link.** Built and measured on the polished header, it adds **0.00 KB** of JS on home, roadmap, catalogue, simulation, lesson, lab and tree pages.
