# Increment 2b implementation report

## 1. Repository state

- Branch: `feat/phase-3-2b-nostr`.
- Base: `f69326f8c9026a6c59cfb4f18ffe4c7ebd08d6f4`, PR #7's verified merge. Its tree equals the reviewed second parent, `042bfde`.
- Post-merge main CI: [41886811561](https://github.com/comwanga/bitsacco-jifunze/actions/runs/41886811561), success. No branch CI is claimed: nothing has been pushed.
- Local checkpoints: `3b8d509` (plan), `8841e17` (API and vectors), `e1d3dc1` (frontend and onboarding). Each SSH signature verified against the configured allowed signer. The final evidence commit and final clean-tree check are reported in the handoff.
- No 2a history changed, no push, PR or merge. Ignored environment and engineering files retained. Verification artifacts are local under `.superpowers/phase-3-2b/`.

## 2. Implemented functionality

`POST /api/auth/nostr/challenge` stores a five-minute `nostr/signin` challenge in the existing table, with hashed nonce and browser binding, language and validated return path. It sets the existing Secure, HttpOnly, SameSite=Lax pre-auth cookie. `POST /api/auth/nostr/verify` validates the signed Authorization event and exact raw body before the challenge can be consumed.

The NIP-07 frontend requests one signature after explicit activation, hashes the exact POST body with Web Crypto and sends only standard public event fields. It handles missing signer, rejection, signing error, invalid proof, expiration and connection failure, announces status/errors, focuses errors and locks duplicate activation. GitHub and recovery remain available. New accounts use the existing ten-code welcome flow; returning public keys retrieve the same internal account without another initial code set.

Nostr uses the existing hashed-token full session, cookie, expiration, idle timeout, logout and revocation mechanisms. Account lookup uses the canonical hex public key, never a profile name. There is no automatic linking or merge. GitHub replacement requires an existing GitHub identity, closing a potential cross-provider recovery path for Nostr-only accounts.

### Identity creation and custody boundary

- **Existing identity authentication:** the compatible browser signer supplies the signed proof; learners never enter a private key on Jifunze.
- **Beginner onboarding:** explicit existing/new identity choices, bilingual steps, signer detection recheck and public/secret key and backup guidance. Public onboarding prose is server-rendered to preserve the JS ceiling.
- **External signer generation:** creation and backup happen inside the learner's signer. Guidance links Alby's official [identity setup](https://guides.getalby.com/user-guide/browser-extension/features/nostr) and [Master Key backup](https://guides.getalby.com/user-guide/browser-extension/features/master-key) documentation as examples, with live Jifunze interoperability explicitly pending. The text explains shareable `npub`, secret `nsec`, encrypted backups where supported and permanent loss without a usable backup. Jifunze recovery codes do not restore a Nostr key. Canonical hex remains the protocol/database identifier, as [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md) specifies; the signer handles human-facing key exports.
- **Future integrated generation:** none implemented. Browser key generation or encrypted local custody requires a separate assessment and approval. Mobile/remote signer creation and backup assessment belongs to 2c. No private key inputs, storage, backup upload or restore claims were added.

## 3. Security evidence

- `@noble/curves` **2.4.0**, the spike's approved primitive; its sole transitive crypto dependency is `@noble/hashes` 2.4.0. No browser crypto package, NIP-46 client, relay, WebSocket or CSP expansion.
- Permanent tests cover all **19 official BIP-340 vectors**, the approved NIP-01 serializer (including seven escapes, Unicode and U+0001), and **five recorded public relay events**, checking both canonical IDs and signatures.
- The spike's historical 200 events were not committed and cannot be recovered from the repository. Fresh fixtures have explicit provenance; no historical rerun is claimed.
- **Material specification evidence:** the official NIP-98 illustrative event's supplied ID does not match its canonical hash (`2dd2dfec3df85dd0d4c32af50241f56a077b0969cb508f987afac1e25b0d4c76`). It is retained as a negative fixture. The approved validation was not weakened. `SITE_ORIGIN` already contains the scheme, so the exact endpoint path is appended; local HTTP and future HTTPS use their configured scheme.
- Shape, canonical ID, Schnorr signature, kind 27235, empty content, inclusive ±60 seconds, unique exact URL/method/payload tags, raw-byte digest, origin, nonce, purpose, provider, expiry and browser binding are tested. Malformed encodings and unexpected event properties are rejected.
- Invalid signatures cannot burn a valid challenge. **20 concurrent valid uses: one success, 19 refusals**, one account and one session. Five independent concurrent challenges for one key create one account.
- Consumption, account/identity lookup or creation, new session, previous-browser-session revocation and audit insert share one PostgreSQL transaction. Session/audit failures roll back state, including challenge consumption and previous-session revocation. Deleted accounts cannot sign in.
- Recovery redemption revokes prior Nostr sessions and retains the restricted recovery scope. Provider ownership and existing GitHub account boundaries remain enforced.

## 4. Executed verification

| Check | Result |
|---|---|
| API PostgreSQL suite | **206 passed** (53 new Nostr tests: 38 crypto, 15 integration) |
| Account Chromium suite, one worker | **31 passed** |
| Complete learning/offline desktop and mobile suite, one worker | **148 passed, 52 existing skips** |
| Focused complete fake NIP-07 contract checks | **3 passed** after adding its required `getPublicKey` method |
| Application unit tests | **135 passed**, 26 files |
| Site and API TypeScript | Passed |
| ESLint | Passed |
| Content validation | 0 errors; 69 existing draft/content warnings |
| English/Kiswahili parity | Passed, account and onboarding modules |
| Approved copy preservation | All 168 existing account strings and eight approved terminology entries unchanged |
| Production Next build + postbuild CSP/link/budget checks | Passed; Node heap capped at 1 GiB |
| UX JS budgets and activated simulation browser budgets | Passed; no budget changes |
| Root and API production dependency audits | Zero vulnerabilities |
| Site and lab Compose configuration | Passed |
| Lab unit tests | **41 passed**; existing Python resource warnings |
| Isolated lite lab model solutions and checks | **19 passed**, one full-profile exercise skipped |
| API Docker image, Node 24.22.2 | Build passed; offline 19-vector / five-event / positive NIP-98 / route-import smoke passed |

Browser checks exercise keyboard activation, radio navigation, focus, error announcements, 360px overflow, missing-signer fallback and axe WCAG checks in both languages. The fake signer produces authentic Schnorr signatures through the real API and PostgreSQL. Arbitrary signer properties are not transmitted to the API. Existing service-worker tests confirm no API responses or account pages are cached; offline learning and device-local progress regressions pass.

Lab tests reused the existing lab image; source unit tests mounted the current repository read-only, and solution checks used the separate `jifunze-2b-regression` project with fresh isolated volumes and no published ports. Its containers, volumes and network were removed afterward; all original lab containers retained their original uptime. A lab image rebuild and the unchanged nginx proxy regression script were not repeated locally; main's CI covers their baseline and branch CI remains pending.

Measured JS change against the existing 2a build: **0 bytes on all 100 non-account pages**. Maxima remain home 143.25, roadmap/tree 143.45, catalogue 142.14, simulation 141.60, lesson 145.84 and lab 151.76 KiB gzip. Sign-in: 151,147 → 153,061 bytes gzip (**+1,914 bytes / 1.87 KiB**), 149.47 KiB total, below the unchanged 150 KiB ceiling. Other account pages add 864–967 bytes. No Nostr module loads on learning pages.

A rough local verifier microbenchmark (200 samples while browser checks were active, excluding PostgreSQL) measured mean 8.10 ms, p95 14.18 ms. This is diagnostic evidence, not a throughput or deployment SLA.

## 5. GitHub regressions

The API suite includes the existing sign-in, PKCE/state, re-authentication identity matching, session binding, concurrent replacement and recovery transaction tests. Account browsers pass both-language GitHub sign-up/sign-out, denied consent, returning identity, single initial recovery issuance, recovery redemption/reuse and GitHub identity replacement. These use the existing fake GitHub service. A fresh live GitHub App consent check was not performed in this increment.

## 6. Limitations and release gates

- A real NIP-07 signer login and real signer identity creation/backup were **not executed**. No signer is claimed to have passed live Jifunze interoperability. Automated NIP-07 coverage is simulated, with real signatures.
- New Kiswahili text is **pending maintainer review** in `content/terminology-review.json`; existing approvals are retained.
- Branch CI, production HTTPS/front-proxy checks and the approved administrative-removal legal review remain release gates. Main's successful post-merge CI is separate evidence. No general release is claimed.
- Host Node is 24.19.0, below the repository's declared minimum 24.20.0; the executed local site/test results are reported honestly. The production API image was built and its cryptography and route imports were additionally checked on pinned Node **24.22.2**. Branch CI still needs to verify the full suite on the supported toolchain. No host toolchain upgrade was made.
- Recovery codes are usable for Nostr accounts, but replacing a lost Nostr identity and cross-provider recovery/linking remain deferred. The UI states this limitation.
- No unresolved security finding is known from the executed checks. Live signer and deployment interoperability remain unverified boundaries, not claimed passes.

## 7. Roadmap and queued work

Proposal only: prioritize secure learning-progress synchronization immediately after 2d, before the full community and contribution-discovery experience. Progress must belong to the internal account ID, with explicit local merge consent. No synchronization or roadmap reordering was implemented.

The requested footer layout correction is recorded in the local implementation queue. It remains separate from this authentication branch and will need its own branch, visual evidence and signed commit.

## 8. Recommendation

**READY FOR REVIEW.** Local implementation and regression checks pass. The smallest next action is to review the code and new Kiswahili wording, then perform a real signer check. CI requires separate publication authorization; no push, PR, merge or general release is authorized by this report.
