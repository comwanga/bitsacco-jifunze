# Stage 5: NIP-46 acceptance review

Date: 12 November 2026. Branch: `feat/nip46-mobile-signing`, from Stage 4 `9af5ee9`. The design was read from `docs/nostr-first-design:docs/superpowers/specs/2026-11-12-nostr-first-identity-design.md` and section F3 of `docs/superpowers/specs/2026-11-04-phase-3-design.md`. No push, pull request, merge, deployment or account activation is authorized or performed by this work.

## Verdict

The implementation matches the approved design and is ready for acceptance with real signer applications on staging. It is **not** ready for release: no real signer application and no phone has been used against it, and the design's release gate (an Android phone and two independent signers) is still open.

The review found three defects and corrected them. None weakened server-side authentication.

## What each kind of evidence covers

| Kind | What was done | What it does not show |
| --- | --- | --- |
| Automated verification | Unit, API (PostgreSQL), and browser suites listed under "Checks" | Behaviour of any signer application |
| Simulated signer | `npm run e2e:remote-account`: the real browser code, NIP-44 encryption, signatures and API, against a signer and relay simulated inside the test | Interoperability with a signer application, or with a real relay |
| Live relay checks | The real client module in Node, with a local stand-in signer and throwaway keys, through public relays from one network in one hour | Relay behaviour from learners' networks, over time, or under load |
| Real-device acceptance | **Not performed** | n/a |

## Defects found and corrected

1. **One unreachable relay ended the whole attempt.** Any relay socket closing ended the attempt, even when another listed relay worked. A `bunker://` address commonly lists several relays. Reproduced with a two-relay address where one relay refuses connections: sign-in failed with "relay connection was interrupted". An attempt now ends only when no relay of the current list is left. Reproduced again live: with `relay.nsec.app` unreachable and `relay.primal.net` working, sign-in completed in 5.5 s.
2. **The only pairing relay was unreachable.** `relay.nsec.app` timed out on every check from the review network while other public relays answered in under a second (table below). With a single relay, the link and QR path could not work there at all. The pairing list is now `relay.nsec.app` and `relay.primal.net`; either one is enough.
3. **Transport failures were reported as a bad signer.** When no relay accepted a request, the learner was told the signer's response could not be verified. They are now told the relay connection was interrupted. A mistyped bunker address had the same wrong message and now has its own.

Two interface corrections follow from the acceptance brief rather than from a failure:

- The bunker address was one of two choices every learner had to read first. It is now inside a closed "I have a bunker address (advanced)" section; the primary journey is one Start button.
- "NIP-46" and "relay" appeared unexplained. The text now says what a signer app does, calls the feature remote signing, and describes a relay as a message server. A line under the app link says what to do if nothing opens.

## Conformance with the design

| Design condition (F3) | Status |
| --- | --- |
| `nostr-tools` 2.25.2, loaded only after "Use a signer app" | Met; the 38.4 KiB chunk is not referenced by the sign-in page, and anonymous lesson pages are checked not to contain it |
| `connect-src 'self' wss:` on the sign-in pages only | Met; a test now enumerates every exported page |
| Relay validation before any connection, for pasted addresses and `switch_relays` | Met; one fixture per rejected class plus valid cases |
| Client key in memory for one attempt; dropped on success, cancel, error, 120 s, `pagehide` | Met |
| Identity is the `get_public_key` result; the server verifies the final event | Met |
| A short curated relay list for `nostrconnect://` | Met after correction 2 (was a single relay) |
| Wrong secret rejected | Met (simulated) |
| Android phone and two independent signers | **Open** |

## Relay assessment

Checks from the review network, 12 November 2026, 16:30–17:15 local time:

| Relay | Reachable | Full sign-in round trip (real client module, stand-in signer) |
| --- | --- | --- |
| `relay.nsec.app` | No: connection timed out on every attempt | Fails safely after 10 s with the "interrupted" message |
| `relay.primal.net` | Yes | 3 of 3, about 4 s each |
| `relay.damus.io` | Yes | Unreliable: closed connections and lost messages |
| `nos.lol` | Yes | Never: accepts the connection but silently drops NIP-46 messages |

- **Configuration.** One relay was not a list and was a single point of failure. Two relays with "any one is enough" is the smallest change that removes it. `relay.damus.io` and `nos.lol` were rejected on the evidence above.
- **Availability.** It can be checked (the probe used here opens a socket, subscribes and publishes a throwaway message), but only from the network that runs the check. `relay.nsec.app` may be healthy elsewhere; it is kept because signer applications commonly use it.
- **Failed connections** end the attempt with a retry message, close every socket and zero the keys. There is no reconnection inside an attempt, and a message lost by a relay is not resent: the attempt then ends at the 120-second limit.
- **Relay switching** validates the signer's whole answer before connecting, and the server still verifies the final event.
- **Configurable relays.** A build-time setting would not help learners. The list is one constant in `lib/nostr/remote.ts`.
- **Unverified.** Both relays are third-party services with no agreement. Their terms, uptime and reachability from learners' networks in East Africa are not established. The owner should confirm the list before release.

## Mobile browser lifecycle

This section is analysis of the code. **None of it has been observed on a phone.**

| Situation | Expected behaviour | Risk to check on staging |
| --- | --- | --- |
| Tapping "Open signing app" switches to the signer | The page is not unloaded, so the attempt keeps running | Whether the browser keeps the relay socket open and runs script while in the background |
| The browser is inactive for a while | The 120-second limit is checked against the clock, so a paused page still expires on return | A paused page may complete late or not at all |
| The socket is suspended or dropped | If every relay socket closes, the learner sees "interrupted" and starts again with a new code | The signer must approve the new connection again. Messages sent while the socket was down are lost: relays do not store them |
| The learner returns after signing | If the proof arrived, the page has already signed in or does so on return | n/a |
| The challenge expires while the signer is open | The page shows "expired"; the server refuses the challenge regardless | Two minutes may be short for a first-time learner with two devices |
| No signer app is installed | Nothing opens; the page keeps waiting and shows the "if nothing opens" line. Chromium behaves this way in the automated suite | Other browsers may show their own error page instead |
| The learner refuses in the signer | A refused signature shows "not approved". A refused connection sends nothing back, so the page waits until Cancel or the limit | n/a |

Switching apps does not restart or repeat anything: an attempt signs at most one event, and only the Start button begins a new one.

One further limit: the server accepts a proof whose timestamp is within 60 seconds. A learner who takes longer than that to approve the signature itself gets the "expired" message and must start again.

No mobile-specific workaround has been added. Reconnection, longer limits or a different signing method would be changes to an approved design made without device evidence.

## Security findings

All confirmed by tests unless marked.

- **What can be signed.** One event per attempt: kind 27235, empty content, exactly three tags, timestamp within 60 seconds, addressed to this origin's `verify`, `reauth` or `replace` route. The signing window applies the same rule to requests from the account page.
- **What is accepted back.** The event must equal the template, carry the paired identity and verify, before it is sent. Extra fields from a signer are never forwarded.
- **Challenges** are single-use, bound to the browser and (except sign-in) to the session, and expire after 120 seconds for remote signing.
- **Earlier attempts.** Each attempt has its own key, so a late answer to a cancelled attempt cannot be decrypted by the next one, and a late signature after Cancel is never submitted.
- **Wrong identity, bad signature, refusal, unsafe relay switch** never reach the server.
- **Account changes.** A session that appears during sign-in, or a learner switch during popup signing, is refused by the server with `account_changed`, and the other learner's session is untouched.
- **Storage and logs.** Nothing is written to browser storage. The page logs nothing; a rejected pairing produces no console output. API request logs contain method, route, status and duration only.
- **Same server rules.** Browser signing and remote signing call the same proof helper and the same routes.
- **Not verified:** what a real signer application displays to the learner when asked to sign, and whether it honours the requested permissions.

## Acceptance procedure on staging with real signer applications

This replaces a separate mobile-only test. It needs authorization the review did not have: deploying this branch to the allowlisted staging environment, enabling authentication there (`STAGING_AUTH_ENABLED` is 0 today), and adding each tester's public key to `TESTER_NOSTR_PUBKEYS` as described in `docs/deployment/railway-staging.md`.

Use at least two independent signers: one Android application and one web or remote bunker. Record the signer name and version, the device, the browser and version, the network, and the time taken for each step. Record every failure with the exact message shown.

**A. Sign in (run once per signer, in English and once in Kiswahili)**

1. Open `https://staging.bitsaccojifunze.xyz/en/account/signin/` signed out. Choose "Use a signer app", then "Start connection".
2. Same device: tap "Open signing app". Second device: scan the code with the signer.
3. Approve the connection in the signer, and the signature if it asks. Note what the signer shows about the request.
4. Return to the browser. **Pass:** the welcome page with ten recovery codes appears in under 60 seconds from step 1, with no error.
5. Confirm the account page shows the same public key the signer shows.

**B. Session persistence**

6. Close the browser completely, reopen the account page. **Pass:** still signed in.
7. Complete a lesson step. **Pass:** the status under the lesson reports it saved to the account.

**C. Progress across devices**

8. On a second device or browser, sign in with the same identity (browser signer or signer app). **Pass:** the progress from step 7 appears; new progress made here appears on the first device after a reload.

**D. Sign out and recovery**

9. Sign out on one device. **Pass:** the account page asks to sign in; the other device is still signed in.
10. Sign in with one recovery code from step 4. **Pass:** the restricted recovery session opens and the code cannot be used twice.
11. From the account page, request new recovery codes and choose "Use signer app in a new window". Approve in the signer. **Pass:** the account page confirms the identity and shows new codes; the earlier codes no longer work.

**E. Failure handling (each must leave the learner signed out or unchanged, with a clear message)**

12. Start a connection and wait two minutes without approving. **Pass:** "expired" message; a new attempt works.
13. Start, then press Cancel; approve the old request in the signer afterwards. **Pass:** nothing happens; a new attempt works.
14. Refuse the signature in the signer. **Pass:** "not approved".
15. Start, switch the phone to aeroplane mode for ten seconds, switch back. Record what the page shows and whether a new attempt works.
16. On a phone with no signer app, tap "Open signing app". Record what the browser does.
17. For step 11, use a signer holding a different identity. **Pass:** the account page reports the key does not match and nothing changes.

**F. Android lifecycle observations (record, do not judge in advance)**

18. In step 2 on the same device, note whether sign-in completes while the browser is in the background or only after returning.
19. Stay in the signer for 30 seconds, then 90 seconds, before approving. Record the result each time.
20. Repeat step A with battery saver on.

A signer application is named as supported only after it passes A to E on a real device. Investigate and correct only failures that can be reproduced; record the rest.

## Checks

Run on the final code of this review.

| Check | Result |
| --- | --- |
| Lint, site and API type checks | Pass |
| Unit tests | 243 of 243 |
| Remote signing with a simulated signer | 18 of 18 |
| Account, learner lifecycle and allowlist browser suites | 39 of 39, 7 of 7, 12 of 12 |
| Anonymous learning downloads no remote-signing code | 4 of 4 |
| API tests on PostgreSQL | 332 of 332, run before this review; the review changed no API code |
| Main browser suite on the default build | 246 passed, 62 skipped, run before this review; not repeated, because the review changed only code loaded after "Use a signer app" |
| Sign-in page initial JavaScript | 150.800 KiB of 151 KiB (Stage 4: 150.765) |
| Remote signing chunk, loaded on request | 38.4 KiB gzip |

No budget was raised.

## Remaining blockers

1. Real signer acceptance on staging, which needs the authorizations listed above.
2. The Android phone and two-signer gate from the design.
3. Owner confirmation of the two pairing relays.
4. Owner review of the Kiswahili strings, recorded as pending in `content/terminology-review.json`.
5. Sign-in page JavaScript has 0.2 KiB of room under its limit. Any further sign-in page change needs measuring first.
