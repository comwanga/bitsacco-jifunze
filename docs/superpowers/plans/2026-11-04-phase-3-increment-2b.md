# Increment 2b: NIP-07 execution and evidence

## Baseline and review

- PR #7 merged 2026-11-04 at `f69326f8c9026a6c59cfb4f18ffe4c7ebd08d6f4`.
- Post-merge CI: https://github.com/comwanga/bitsacco-jifunze/actions/runs/41886811561 (success).
- Clean tracked working tree; local ignored build, environment and engineering evidence preserved. Branch: `feat/phase-3-2b-nostr`, from updated main.
- Preflight: approximately 1.8 GiB free RAM, 328 GiB free disk; Docker 29.8.0 available. Reuse the existing throwaway PostgreSQL container; run heavy checks sequentially.
- Read approved F2–F5, H1–H3 and the Nostr investigation. Compared official [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md), [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md), [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md). F2 intentionally tightens NIP-98: empty content, exact unique tags, mandatory body digest, five-minute single-use browser-bound challenge. Preserve its dedicated serializer. `SITE_ORIGIN` already includes the scheme: append the exact endpoint path, without adding `https://`.
- Evidence gap: the spike reports 200 relay events and 19 BIP-340 vectors, but did not commit the recordings or CSV. Promote its verifier cases and obtain permanent official vectors and a recorded event fixture with provenance; do not claim the historical recordings were recovered.

## Execution plan (reviewed against the approved scope)

1. **Verifier, test first.** Pin the spike's `@noble/curves` 2.4.0 API dependency, reuse Node SHA-256, promote NIP-01 serialization and NIP-98 checks. Test official BIP-340 vectors, recorded events, malformed structures, wrong ids/signatures/kinds/tags/URLs/methods/payloads and ±60-second boundaries. The verifier proves the event before any challenge write.
2. **API and account transaction, test first.** `POST /api/auth/nostr/challenge` accepts language and a validated return path; stores only nonce/binding hashes in existing `auth_challenges`, expires in five minutes, sets the existing Secure/HttpOnly pre-auth cookie. `POST /api/auth/nostr/verify` checks origin and exact URL, header and raw body; atomically consumes only a `nostr/signin` challenge and creates/looks up the pubkey identity, creates the existing full session, revokes the browser's previous session and logs a secret-free event in ONE transaction. Tests cover replay, binding, rollback, 20-way race and simultaneous new-account sign-ins. No automatic linking. Reuse recovery issuance and session expiration/revocation tests.
3. **Route-local NIP-07 flow and bilingual copy.** Detect signer, show usable fallback, lock duplicate clicks, request one signature, hash exact POST body with Web Crypto, submit Nostr Authorization, redirect to welcome/account. Preserve GitHub and recovery options. Add only necessary copy keys and mark new Kiswahili wording pending review; retain approved text. Display Nostr identity truthfully and prevent GitHub replacement from becoming cross-provider recovery.
4. **Browser verification, test first.** Fake NIP-07 signer using real signatures through the real API/PostgreSQL. Both languages: new/returning login, ten initial codes once, missing signer, rejection/error, duplicate activation, keyboard/focus/error announcements and axe. Run existing GitHub sign-in/re-auth/recovery checks, service-worker/offline checks, parity, API typecheck/tests, lint/typecheck/unit/content, production build, JS budgets and full browser suite sequentially. Check resources before build/Playwright. Real signer test remains pending if no compatible live signer is available.
5. **Review and evidence.** Inspect diff, dependencies, privacy, transaction and identity ownership boundaries. Record results and exact JS impact; keep small SSH-signed commits, verify each signature, no attribution trailers. No push/PR/merge.

## Boundaries and roadmap proposal

No NIP-46, relay/WebSocket/CSP expansion, private-key handling, automatic linking, Nostr identity replacement, or progress synchronization. Existing anonymous/offline progress stays device-local and unchanged.

Proposal for separate approval: prioritize secure account-owned learning-progress synchronization immediately after Increment 2d, before the full Builder Community and contribution-discovery experience. Progress belongs to internal account IDs; merging local progress must require explicit consent. This increment records the proposal only and does not change the approved implementation order.

## Execution results

Pending execution. CI on this local branch is not claimed; H3 requires CI after an authorized publication, terminology review and legal review before general auth release.
