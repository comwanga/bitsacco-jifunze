# Account development and security boundaries

This guide is for the retained local account compatibility stack. The public website has no account API, sign-in or database. Staging authentication remains disabled. Authentication/provider acceptance is separate unfinished work; see the [staging record](../deployment/railway-staging.md) and [production runbook](../deployment/production.md). Run these commands from the repository root.

Local account exports must use a local `SITE_ORIGIN` so the public-origin build does not replace sign-in with its anonymous explanation. Pass the local origin explicitly when building the web image; no production configuration should be copied into this stack.

The optional account (Nostr sign-in and recovery codes) is a small Node 24 API in [`api/`](../../api/) with PostgreSQL. nginx serves the site and proxies `/api/` to it. The site starts and serves pages without the API.

```bash
cp api/.env.example api/.env.local   # fill in the recovery pepper; the GitHub App is optional
docker compose build --build-arg SITE_ORIGIN=http://localhost:8080 web
docker compose build api
docker compose up --no-build         # http://localhost:8080/sw/account/
```

- `api/.env.local` is git-ignored and is not sent to Docker builds. Secrets are never committed: compose reads them at run time.
- Open `http://localhost:8080`, not `127.0.0.1:8080`: the API checks each POST's origin against `SITE_ORIGIN` (`http://localhost:8080`) and refuses others with `bad_origin`.
- Only the site is published, on `127.0.0.1:8080`. The API and the database have no host port. This is a local development stack, not a production boundary.
- Sign in locally with Chromium or Firefox. The session cookie is `__Host-` and `Secure`, and Safari/WebKit refuses it on `http://localhost`.
- The rate limits live in the API's memory, so they reset whenever it restarts.
- GitHub is optional. With both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` unset the API starts without it: no `/api/auth/github/*` path exists and session cookies are `SameSite=Strict`. The sign-in page shows a GitHub button only when the site is built with `JIFUNZE_GITHUB_SIGNIN=1`; the default build, including the Docker web image, offers Nostr only. Setting only one of the two is a configuration error.
- If GitHub is configured, it requires the `redirect_uri` to match a registered callback. Register all three on the GitHub App: `/api/auth/github/callback`, `/api/auth/github/callback/reauth` and `/api/auth/github/callback/replace` (for example `http://localhost:8080/api/auth/github/callback`).

```bash
export TEST_DATABASE_URL=postgres://...   # a throwaway PostgreSQL database
npm run api:test
SITE_ORIGIN=http://localhost:4352 JIFUNZE_GITHUB_SIGNIN=1 npm run build   # the suites also cover the GitHub module
npm run e2e:account                      # Chromium, against the real API and a fake GitHub
```

`npm run e2e:account` starts a fake GitHub (`api/test/fake-github-server.ts`) with a test-only consent page. It is not real GitHub authentication. CI runs both, validates `compose.yaml` and builds the API image.

## Nostr account lifecycle

Stage 1 of the Nostr-first identity design (`docs/superpowers/specs/2026-11-12-nostr-first-identity-design.md`, proposed separately) adds these routes. Each proof is a NIP-98 event signed for that route's own URL, over a single-use challenge bound to the browser and, except for sign-in, to the session that asked for it.

| Route | Session | Effect |
| --- | --- | --- |
| `POST /api/auth/nostr/challenge` with `purpose` `signin`, `reauth` or `replace` | none for `signin`; full for `reauth`; full or recovery for `replace` | Issues the challenge and the URL to sign for |
| `POST /api/auth/nostr/reauth` | full | The account's own key confirms; refreshes this session's re-authentication time. Another key is refused (`nostr_key_mismatch`) and the challenge is spent |
| `POST /api/auth/nostr/replace` | recovery, or full re-authenticated within 10 minutes | Attaches the newly proven key to this session's account, revokes every session and starts a fresh one, and replaces the recovery codes. A key held by another account is refused (`identity_in_use`) and nothing changes |
| `POST /api/auth/logout/all` | any | Revokes every session of the account |
| `POST /api/me/delete` with `{"confirm":true}` | full, re-authenticated within 10 minutes | Deletes the account with its identities, sessions, challenges and recovery codes |

Key replacement rotates the recovery codes in the same transaction: every earlier code stops working and the response carries a fresh set once, in `codes`. The Stage 4 account and recovery pages use these routes and show those codes before leaving the replacement flow. No secret key, seed phrase or signer password is ever sent to the API.

### Learner account controls (Stage 4)

`components/account/AccountSecurity.tsx` loads only after `/api/me` confirms a Nostr identity. Regenerating recovery codes, replacing a key from a full session, and deleting an account first request a fresh proof from the existing identity. A separate confirmation then performs the change; confirming identity alone changes no key or codes. A rejected, expired or mismatched proof cannot advance the flow. Key replacement from a restricted recovery session uses the recovery code as its authority. The built-in flow sets up this device's learning identity; advanced users can select an identity inside their own signer.

The controls recheck the current account and session scope before acting. Known-account requests also carry `X-Jifunze-Account`, a non-secret **expectation**, not an account selector or credential. The API compares it with the authenticated cookie's account and returns `409 account_changed` before calling any handler if they differ. This closes the gap where another tab signs in after a page's check but before its mutation, including a progress upload. A caller cannot use the header to read or write another account; no cookie still means `401`. The condition is optional for compatibility with existing clients, which remain scoped to their cookie. The browser uses it whenever it already knows the account. The value never appears in the interface or request logs.

- Replacement preserves the account and server progress, ends earlier sessions and shows the atomic response's new codes once. Codes remain in component memory, never a URL or browser storage. Copy/download remain deliberate actions; download URLs are revoked. Leaving warns while codes are displayed, and page-hide clears the component's codes so a restored page does not offer that set again.
- A missing response to a sensitive action is treated as an uncertain outcome, not a failed transaction. The confirmation button is disabled and the learner is directed to check the account before starting another attempt.
- Deletion explains the permanent server-side loss and requires an unchecked confirmation box. The device copy is kept by default. Requested removal requires the latest local copy to be covered by a confirmed server response; unsupported timestamps, work made during a request and other learners' copies are retained. A kept copy belonging to the deleted account loses that owner marker so it can later be added to a new account by explicit consent.
- Sign out everywhere confirms the scope and retains local work. It cannot remotely erase another device's copy. The existing device-only sign-out retains its shared-device removal option and now rechecks the latest copy after the logout response.
- The recovery form masks codes, clears a submitted code from component state, and refuses text outside the recovery-code format before any request. Lost-key guidance distinguishes recovery of this account from restoration of a secret key. Initial code saving requires the backup acknowledgment before Continue; the earlier skip link was removed with Option A.
- Beginner guidance keeps anonymous learning available, explains backups separate from the phone and each learner's identity on shared phones, and makes no supported-signer claim.

Run the complete compatibility suite serially, followed by the learner lifecycle suite. Each invocation starts a fresh API. This separation preserves the real recovery limit of five attempts per source per 15 minutes; tests and production rate limits are unchanged.

```bash
npm run e2e:account -- --workers=1
npm run e2e:learner-account
npm run e2e:allowlist
```

See the [Stage 4 implementation record](../audit/2026-11-12-learner-account-experience.md) for checks, limitations and remaining release gates. New and changed Kiswahili remains pending owner review in `content/terminology-review.json`.

### Remote signing with a signer app (Stage 5, NIP-46)

The advanced sign-in section offers "Use a signer app" beside the browser-signer (NIP-07) path. The learner pairs through a `nostrconnect://` link, the same link as a QR code, or a pasted `bunker://` address. Remote signing only replaces *who signs*: the result is the same NIP-98 event, posted to the same `verify`, `reauth` and `replace` routes and verified by the same server code. There is no second server-side authentication model.

- **Loading.** `components/account/RemoteSigning.tsx` and `lib/nostr/remote.ts` (with `nostr-tools` 2.25.2 and the QR encoder) are imported only after the learner presses the button. No other page downloads them, and no relay socket exists outside an active attempt.
- **One attempt, in memory.** Each attempt generates its own client key and pairing secret. Nothing is written to browser storage. Completion, cancellation, failure, a 120-second deadline and leaving the page all close the sockets, reject pending calls and zero the key buffers. An attempt signs at most one event, and a retry starts with new credentials, so a late answer to an earlier attempt has nothing to arrive at.
- **What a signer may be asked.** Only `get_public_key` and `sign_event` for kind 27235, with a template limited to this origin's three proof routes. The returned event must match the template exactly, carry the paired identity and verify before it is sent. The server then verifies it again; a connection alone proves nothing.
- **Relays.** `wss:` to public hosts only; a signer's `switch_relays` answer is validated in full before any connection. Pairing by link or QR code uses the two relays in `PAIRING_RELAYS`; a pasted address names its own. One working relay is enough: a relay that closes, or sends `CLOSED` or `AUTH`, is dropped, and the attempt ends with a retry message only when none is left. There is no reconnection inside an attempt.
- **Challenges.** A remote challenge and its browser cookie live 120 seconds (`remote: true` on the challenge request) instead of 300. Single use and session binding are unchanged.
- **Account condition.** Remote sign-in sends `X-Jifunze-Account: anonymous` when it starts signed out. This asserts only that the browser still has no session: if another learner signs in during pairing, the late proof answers `409 account_changed` and their session stands. The value is never an account id and grants no access. Re-authentication and key replacement keep the account id condition as before.
- **Sensitive actions.** The content security policy permits `wss:` on the two sign-in pages only. The account page therefore opens the sign-in page in a new window for pairing and receives the signed event by same-origin `postMessage`; the challenge, the account condition and the request stay with the account page.

```bash
npm run e2e:remote-account   # same build and TEST_DATABASE_URL as e2e:account
```

That suite drives the real browser code, real NIP-44 encryption, real signatures and the real API against a **simulated** signer and relay. It is not evidence of interoperability with any signer application or phone. No signer application is named as supported until one has passed live acceptance on a device. The [Stage 5 acceptance review](../audit/2026-11-12-nip46-acceptance.md) records the relay checks, the open risks and the staging procedure for real signer applications.

### Built-in Jifunze learning identity (Option A)

The default sign-in action is **Save my progress / Hifadhi maendeleo yangu**. It creates a dedicated learning key in this browser's IndexedDB before using the existing NIP-98 challenge flow. Existing matching sessions continue directly; an expired session can be reopened using the retained device key without repeating onboarding. Browser and remote signers remain in the advanced section (`#own` opens it; `#remote` remains the popup bridge).

The [security assessment and implementation evidence](../audit/2026-11-12-learning-identity.md) explains storage loss, XSS/device compromise and recovery limitations. IndexedDB is not encrypted by Jifunze and is not a secure enclave. Recovery codes recover account access, not the original signing key. They cannot undo compromise. The UI warns against funds or primary Nostr identity reuse and requires the backup acknowledgment before the onboarding Continue button works. At device sign-out, removing the local identity is checked by default, separately from removing confirmed progress. Keeping an identity permits later sign-in; a borrowed/unlocked browser is not a private account boundary.

Recovery creates or uses this browser's learning identity and submits the existing replacement proof, preserving the account/progress and rotating codes and sessions atomically. Learners using external signers select that advanced option during recovery. No API routes, schema, account proof rules, sync ownership rules or tester gates change. Staging rejects generated keys until an operator explicitly allowlists the **public** key shown in advanced details; this implementation does not enroll testers or deploy anything. Production accounts remain disabled.

```bash
npm run e2e:device-account # real browser + API + throwaway PostgreSQL, fresh API/recovery limits
```

## Server copy of progress

Stage 2 of the design adds a server copy of a learner's progress (`api/migrations/0002_progress.sql`, `api/src/progress.ts`). The browser side is described under "Progress synchronisation in the browser" below.

| Route | Session | Behaviour |
| --- | --- | --- |
| `GET /api/me/progress` | full | The account's progress as a version 1 document, the same format as the device copy and the export file |
| `POST /api/me/progress` | full | Merges a version 1 document (some or all lessons) into the account's copy and returns the merged whole |

- The account is always the session's. No path, query or body field can name another account, and a recovery session reaches neither route.
- `POST` only ever adds: earliest completion, earliest discussion confirmation, best quiz, union of lab passes. It applies the same rules as `mergeProgress` in `lib/progress/model.ts`, including the final tie-break (same ratio at the same instant: more questions wins), so a stale, repeated or reordered request cannot remove or change newer work. There is no way to un-complete a lesson through this API.
- Timestamps must be exactly what the site writes: UTC with milliseconds, for example `2026-11-12T08:15:30.123Z`. Any other form, an impossible date, or a time more than five minutes ahead of the server is refused with `400`. The device compares timestamps as text and the database as instants; the two only agree in this form.
- Limits: 64 KiB per request (this route only), 500 lessons per account, 100 lab passes per lesson, lab identifiers up to 64 characters, quizzes up to 1,000 questions, 60 merges and 120 reads per minute per account. A request that would exceed a per-account limit is rolled back whole.
- Deleting the account deletes its progress. Nothing is sent to a Nostr relay or any other service, and request logs carry the route only.

## Progress synchronisation in the browser

Stage 3 connects the device copy to the account copy (`lib/progress/sync.ts`, `components/account/ProgressSync.tsx`). The device copy stays the one the site reads; nothing about anonymous learning changes.

- **Anonymous learners:** no request to the account service, no sync code downloaded, no sync state stored. A browser test asserts all three.
- **Loading:** the sync code is fetched on demand, and only when the browser holds a sign-in marker (`jifunze:account:v1`, which is `?` or the account id and never a token). It is not part of any page's first load.
- **A sync** posts the device copy to `POST /api/me/progress` and merges the answer back into whatever is stored at that moment, so work written during the request is kept. It runs after sign-in, about two seconds after a local change, when the connection returns, when the tab becomes visible again, and at once when the page is being left with unsent work. A page load does not ask again within five minutes unless something is unsent.
- **Offline or failed:** the change is already on the device and is marked unsent (`jifunze:sync:dirty:v1`); it goes up on the next successful sync. A `401` clears the sign-in marker and stops syncing; the device copy is left as it is.
- **Whose copy it is** (`jifunze:progress:owner:v1`):

  | Device copy | Signed-in account | Behaviour |
  | --- | --- | --- |
  | Empty | Any | Becomes that account's copy; saved progress is restored |
  | Made without an account | Any | Nothing is sent. The account page asks; only "Add it to my account" links it |
  | The same account's | That account | Synced |
  | Another account's | A different account | Never merged and never uploaded. It can be downloaded, and replaced only after an explicit confirmation |

- **Sign-out:** when the device holds this account's progress, the learner chooses to remove it from the device (the default) or keep a copy. It is removed only after a final sync has confirmed the account holds everything; otherwise it is kept and the page says so.
- **Timestamps:** an imported file's readable timestamps are rewritten as the same instant in the canonical UTC form. An unreadable one stays on the device unchanged and is left out of the upload; no time is invented. If the device clock is ahead, values still in the server's future are held back and sent once that time has passed.
- **Persistence visibility (Stage 4):** a small polite live status below lesson completion distinguishes local saving, pending work, confirmed account saving, offline work, a merge decision, another account's device copy and an ended session. Anonymous status is rendered with the lesson and loads no sync code. Signed-in status uses the existing lazy module and local storage events, not another polling loop. An expired-session marker lets later lessons explain the pause without retrying the API. No account id appears in this status.
- **Confirmation accuracy (Stage 4):** a successful HTTP response is not enough to report everything saved. The server document must cover the latest canonical device copy. Otherwise the result remains `pending`, the dirty marker stays set, and the copy cannot be removed during sign-out or deletion. Withheld imported/future values do not start an endless two-second retry loop. A busy cross-tab lock is also pending, never a success.
- No learner's progress is sent to a Nostr relay. Phone signing is available through the advanced NIP-46 flow described above.

## Logs

Both nginx and the API log to the containers' stdout and stderr (`docker compose logs`).

- **What nginx keeps out:**
  - Access logs record the path only, never the query string. This includes requests nginx rejects itself, such as a 400.
  - Client addresses are truncated to /24 (IPv4) or /48 (IPv6).
  - No referrer is logged for `/api/`, and no `X-Forwarded-For`, cookies or bodies anywhere.
- **What the API keeps out:** it logs the method, route template, status and duration, and counts of recovery outcomes per hour. Never a body, cookie, query string, token or recovery code.
- **nginx error lines are the exception, and nginx cannot redact them.** They quote the full request line and the full client address (`client: …`).
  - They stay on, at the image's normal level, because they are what explains an outage.
  - No `/api/` URL carries a secret except the three GitHub callbacks, which hold the OAuth `code` and `state`. Those three alone log errors only at `crit` and above. Their failures still show in the access log (status, `upstream=`) and in `docker compose logs api`.
  - A malformed callback path, such as one containing a backslash, doesn't match those quiet locations in nginx, so its upstream errors are logged at the normal level, query string included. The API still treats it as a callback, with the same state and PKCE checks. Real codes and states only arrive at the exact registered callback URLs, so such a line can only hold values the requester typed.
- **Access:** anyone who can run `docker` on the host can read these logs. Keep that to operators. Never forward the logs to a shared tool that applies looser rules.
- **Retention policy:** account application logs require a 14-day retention limit (design F6). Compose bounds log size per container (the `local` driver, 3 × 10 MB) but cannot enforce an age limit. The host must enforce the 14 days, for example with journald `MaxRetentionSec=14day` or the log shipper's own retention; this is not a claim that the Compose stack enforces it.

`bash scripts/check-proxy.sh` checks all of this on a throwaway Docker stack: it sends callback requests carrying a code and state, stops the API mid-run, and greps every nginx and API log line.

## Authenticated production deployment gate: the HTTPS front proxy

This nginx listens on plain HTTP, so production needs a TLS terminator in front. **For deployments with an account API, do not deploy behind one until every item below is done.**

1. Uncomment the `set_real_ip_from` / `real_ip_header` / `real_ip_recursive` lines in [`docker/nginx.conf`](../../docker/nginx.conf).
   - Set `set_real_ip_from` to the front proxy's real address range. Never a guess, and never a wide private range other clients share.
   - Without this, every learner arrives from the proxy's address and shares one recovery and sign-in rate-limit bucket. One person's mistakes would then lock everyone out.
2. Make the front proxy append the client address to `X-Forwarded-For`, or overwrite the header.
   - `real_ip_recursive on` then takes the right-most untrusted address, so a learner's own forged `X-Forwarded-For` entries are ignored.
   - The API never reads `X-Forwarded-For`. It takes `X-Real-IP` only from a private peer (nginx), and nginx always overwrites `X-Real-IP` itself.
3. Make sure the front proxy's own access logs leave out query strings, at least for `/api/auth/github/callback*`. Otherwise it records the OAuth code and state that this nginx keeps out.
4. Re-run the checks against the real proxy. Send two requests from different networks and confirm they land in different buckets: after five wrong recovery codes from one network, the other still gets `401`, not `429`. Then confirm a forged `X-Forwarded-For` changes nothing.

`bash scripts/check-proxy.sh` already runs these checks against a stand-in front proxy, with realip on and off. That proves the nginx configuration. It does not prove the production proxy, whose header handling and logging are its own. The stand-in also speaks plain HTTP, so TLS itself is not exercised.
