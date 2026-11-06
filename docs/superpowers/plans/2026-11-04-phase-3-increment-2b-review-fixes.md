# Increment 2b: independent-review corrections

> **Historical phase record.** Decisions, proposals, hostnames, pending gates and results below describe this dated phase, not current operating instructions. See [current guides](../../README.md).

Reviewed baseline: `b873417aa1291d9d81b6faff9284fe25a57cc56a`. Work stays on `feat/phase-3-2b-nostr`; no push, PR or merge is authorized.

## P2: real browser-cache restoration

The completed attempt retained a private ref lock after navigation. The parent's persisted `pageshow` handler cleared only its shared busy state, making the button appear enabled while the child rejected every click.

The correction tracks completed navigation in a ref. Only a persisted `pageshow` for that completed attempt clears its lock and stale status. A pending signer promise remains locked. The parent keeps Nostr's busy state separate from recovery's restoration state, so restoring recovery's form cannot enable GitHub or recovery submission while Nostr signing is pending. API, cryptographic, session and recovery-code behavior are unchanged.

Permanent regression: `e2e-account/nostr-bfcache.spec.ts`, in the `chromium-bfcache` project. It uses full Chromium with the default BFCache-disabling argument removed, no network interception, and the real API/PostgreSQL with a fake signer producing valid Schnorr signatures. Both languages check:

- same-document identity plus a genuinely persisted `pageshow` after browser Back (a reload cannot pass);
- no stale status, a second challenge/signature, a successful returning login and the same internal account;
- duplicate activation starts one pending request;
- a genuinely restored pending request still blocks Nostr, GitHub and recovery submission until approval.

Before the fix, the confirmed baseline run had two failed completed-attempt cases (stale status, signature count stuck at one) and two passing ordinary-pending cases. Production sign-in files were checked unchanged against the reviewed HEAD before that run. Its log, test hash and commit are recorded in `.superpowers/phase-3-2b-review-fixes/red-confirmed.json`; earlier exploratory failures remain separately retained. The corrected preliminary run passed all four cases, including pending-request restoration.

## P3 and proposed Kiswahili refinements

The Nostr recovery explanation now includes the exact warning:

- English: "Creating new recovery codes invalidates all previous codes."
- Kiswahili: "Ukitengeneza misimbo mipya ya kurejesha, misimbo yote ya awali haitatumika tena."

The existing explanation about privacy, fresh sign-in and deferred identity replacement is retained. The four revised entries are `nostrCheckSigner`, `nostrWelcomeLead`, `nostrPublicHelp` and `nostrCodesHelp`. The supplied Kiswahili proposals are used verbatim, with the warning integrated into `nostrCodesHelp`. English remains unchanged except for that warning. The existing account browser checks display the complete recovery explanation in both languages.

The project maintainer, a native Kiswahili speaker, **approved all 28 new English/Kiswahili pairs on 2026-11-05**, including the final `nostrCodesHelp` sentence: "Kubadilisha utambulisho wa Nostr uliopotea kutawezekana katika sasisho lijalo." The approval is recorded in `content/terminology-review.json` and supersedes the earlier pending status. No previously approved Increment 2a wording or approval metadata is changed.

## Final verification provenance

After the local correction commits, freeze the tracked tree before the final verification run. The local runner records the exact full Git HEAD and tree, command, start/end UTC, exit code, resource sample, log SHA-256 and clean-tree checks for every result. Browser cache attachments carry the same commit and actual restoration evidence. Final build measurements include asset hashes. Results live at:

`.superpowers/phase-3-2b-review-fixes/<full-final-HEAD>/manifest.json`

The production build is a prerequisite for the focused browser checks. Run those checks first, then API/GitHub/recovery tests, static checks and unit/parity tests, account browsers/accessibility/privacy, learning/offline browsers, lab checks, production-runtime smoke and budgets, sequentially. The runner stops on a failed check or tracked-tree/HEAD drift. The final handoff reports the completed manifest's actual results; no future run is claimed here.

The host's Node version and the pinned API image's runtime are recorded separately. CI on the supported toolchain remains pending publication authorization. A real NIP-07 extension, disposable identity creation, private signer backup/restore, consent, rejection/cancellation and returning-account acceptance still need the maintainer's live interaction. Simulated signer tests do not establish those passes.

No NIP-46, key generation/custody, database architecture, linking, progress synchronization or footer changes are included.
