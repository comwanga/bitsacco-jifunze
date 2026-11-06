# Lightning kwa Wajenzi: Mastering the Lightning Network track with a live lab

> **Historical phase record.** Decisions, proposals, hostnames, pending gates and results below describe this dated phase, not current operating instructions. See [current guides](../../README.md).

Nov 3, 2026 · design for review

## Intent

Builders who finish "Bitcoin kwa Wajenzi" have only one Lightning lesson. This track takes them through all 17 chapters of *Mastering the Lightning Network* (lnbook) in simplified form, in Kiswahili and English. Instead of only reading, they run the book's commands and their own Python against real Lightning nodes on their laptop, from an editor inside the lesson page. Each step is checked automatically.

## Goals

- One lesson per lnbook chapter (17), simplified, in `sw` and `en`, with a quiz, like every other Jifunze lesson.
- An editor on the lesson page with two tabs, **CLI** and **Python**. Run sends the code to Docker nodes on the learner's laptop and shows the output and pass/fail checks.
- A local lab that starts with one command, fits an 8 GB laptop on Windows (WSL2), macOS or Linux, and has a cloud fallback (GitHub Codespaces).
- The lesson text stays readable on a phone and offline. The lab panel only works on a laptop with the lab running.
- lnbook is credited on every lesson and in `ATTRIBUTIONS.md` (CC BY-SA 4.0 requires it).

## Non-goals (v1)

- Rust or JavaScript runners. The runner interface allows adding them later.
- A hosted lab service run by Bitsacco.
- Mainnet, signet or any real funds. Regtest only.
- Reproducing every detail of the book. Lessons simplify and link to the chapter for depth.

## Anti-goals (failure even if it "works")

- Any website, not just Jifunze, being able to make the lab run code on a learner's machine.
- A lab that needs more than 8 GB RAM for the default profile, or a multi-step manual setup.
- Copying the book's text wholesale instead of simplifying and translating.
- Lab pages pushing the rest of the site over its performance budget.

## Decided

### Track and content

- **A third roadmap**, `lightning`: "Lightning kwa Wajenzi" / "Lightning for Builders". It's a separate path, not 17 more builders lessons. *(my call, accepted in conversation)* The existing `builders/lightning-basics` lesson stays as the on-ramp and links to this track.
- **One lesson per chapter**, with slugs from the lnbook chapter files:

| # | Chapter (lnbook) | Lab in the lesson |
| --- | --- | --- |
| 1 | Introduction | None: concepts, with a quiz |
| 2 | Getting started | Alice pays Dina's invoice from the CLI |
| 3 | How the Lightning Network works | Open a channel, make a payment, read balances |
| 4 | Lightning node software | **Full profile**: the same command on LND, c-lightning and Eclair |
| 5 | Operating a Lightning Network node | Set routing fees, inspect channel state, make a static channel backup |
| 6 | Lightning Network architecture | None: map the protocol layers, with a quiz |
| 7 | Payment channels | Find and decode the funding transaction; watch commitment balances change |
| 8 | Routing on a network of payment channels (HTLCs) | Multi-hop payment Alice→Bob→Chan→Dina; find the preimage |
| 9 | Channel operation and payment forwarding | Cooperative close vs force close; watch the timelock on regtest |
| 10 | Onion routing | Python: build and peel a toy onion (a simplified Sphinx) |
| 11 | Gossip and the channel graph | Read the graph from a node; run a version of `lngraph.py` |
| 12 | Pathfinding and payment delivery | Python: find a route over the node's graph, then pay it |
| 13 | Wire protocol: framing and extensibility | Python: parse a few real message types from captured bytes |
| 14 | Lightning's encrypted message transport | Inspect peers and connections; Noise handshake explained, no lab coding |
| 15 | Lightning payment requests | Decode BOLT11 via CLI, then in Python |
| 16 | Security and privacy of the Lightning Network | Probe a channel's balance with failed payments; discuss defences |
| 17 | Conclusion | Points to the builders capstone (`builders/ship-a-tool`) |

- **Credit on every lesson:** `source: { type: adapted, from: "Mastering the Lightning Network", url: "https://github.com/lnbook/lnbook", licence: "CC BY-SA 4.0", credit: "Andreas M. Antonopoulos, Olaoluwa Osuntokun and René Pickhardt" }`, plus a row in `ATTRIBUTIONS.md`.

### Lab: what runs on the laptop

- Lives in the Jifunze repo under `lab/`, started with `./lab up` (a thin wrapper over `docker compose`).
- **Lite profile (default, about 2 GB RAM):** `bitcoind` (regtest), Alice (LND), Bob (c-lightning), Chan (c-lightning), Dina (LND), `runner`, `bridge`.
- **Full profile (`./lab up --full`, about 3.5 GB):** Chan runs on Eclair, as in the book. Only chapter 4 asks for it.
- **`./lab doctor`** checks RAM, free disk (about 6 GB for images), Docker, WSL2 on Windows, and that port 7777 is free. It explains failures in plain words in both languages.
- **`./lab reset [chapter]`** recreates the regtest chain and the starting channels for a chapter. Every chapter declares the state it starts from (channels, balances) in `lab/scenarios/<chapter>.yaml`.
- The node containers are adapted from lnbook's `code/docker` setup and credited.

### Lab bridge: page ↔ nodes

- A small HTTP service in the `bridge` container, published **only on `127.0.0.1:7777`**.
- Endpoints:
  - `GET /status`: health of each node, plus the profile.
  - `POST /run {node, tab: "cli"|"python", code}`: returns `{stdout, stderr, exitCode, ms}`.
  - `POST /check {exercise}`: returns `[{id, label: {sw,en}, pass}]`.
  - `POST /reset {chapter}`
- **Security (the anti-goal above):**
  - `./lab up` prints a one-time **pairing code**. The learner pastes it into the lab panel once, and the page keeps the token in `localStorage`. Every request needs `Authorization: Bearer <token>`.
  - Only allowlisted `Origin`s are answered: the Jifunze site URL and `http://localhost:3000` for development. CORS and `Access-Control-Allow-Private-Network` are answered for those origins only.
  - Code runs inside the `runner` container, never on the host. The bridge does **not** mount the Docker socket.
  - Each run has a 30 s timeout and a 64 KB output cap. The runner has no network access beyond the lab network.
- **CLI tab:** a bash shell in `runner`, which has `bitcoin-cli`, `lncli`, `lightning-cli` and `eclair-cli` installed. The chosen node sets the wrappers' target, so `lncli` talks to Alice or Dina, and `lightning-cli` to Bob or Chan.
- **Python tab:** Python 3.12 in `runner` with a helper module, `jifunze_lab`, providing `btc()`, `lnd("alice")`, `cln("bob")` and `eclair("chan")` clients. They wrap LND REST, `pyln-client` and the Eclair REST API, so learners write Lightning code, not connection boilerplate.
- **Checks:** Python functions in `lab/checks/<chapter>.py`, one per exercise, that query the nodes and return labelled pass/fail results. Learners can read them; they're part of the lesson.

### Lesson page

- A new MDX component, `<Exercise id="ch08-pay-route" />`. Its starter code, default node and default tab live in `content/lightning/exercises/<id>.yaml`, with model solutions alongside for reviewers.
- **Laptop layout:** the lesson text on the left and a sticky lab panel on the right (status chips, CLI/Python tabs, node picker, Run, Reset step, output, checks). See the brainstorm mockup `lab-lesson.html`. **Phone layout:** the exercise collapses to its starter code plus "Open this lesson on a laptop with the lab running".
- **Editor:** a plain `<textarea>` with a monospace font, Tab inserts spaces, and Ctrl/⌘+Enter runs. There is no CodeMirror, so lab pages stay inside the JS budget ceiling. *(my call)*
- The lab panel's client code loads only on pages that contain an `<Exercise>`.
- **Progress:** passed exercises are stored on the device as `lessons[key].lab = { passed: string[] }`. This is an optional field, so the progress file stays at version 1, and import keeps the field. When all of a lesson's exercises pass, the lesson is marked complete.
- **Browser permission:** current Chrome and Edge ask "allow this site to access devices on your local network?" the first time a public site calls `127.0.0.1`. The lab panel explains this before the first Run, and the pairing step is when it appears. A `localhost` development build doesn't trigger it.
- **Validation:** `validate-content` gains a rule that every `<Exercise id>` has a matching `content/lightning/exercises/<id>.yaml` with a starter for its default tab, and a check function in `lab/checks/` (error), plus a model solution (warning).
- **CSP:** pages with an `<Exercise>` add `connect-src http://127.0.0.1:7777` plus any user-configured bridge URL pattern for Codespaces (`https://*.app.github.dev`). Other pages are unchanged.

### Cloud fallback

- A `.devcontainer/` that runs `./lab up` in GitHub Codespaces. The bridge port is forwarded as **public**, because private ports need GitHub cookies that a cross-site fetch won't send, and is protected by the same pairing token. The lab panel has a "Use a remote lab URL" field.

## Constraints

- All the v1 spec's rules still apply: Kiswahili first, CI content rules 1–5, no third-party scripts, no tracking.
- The lab is regtest-only and never touches real funds or seed phrases from real wallets.
- Node versions are pinned in `lab/versions.env` and checked in CI with `docker compose config`, plus a smoke test that starts the Lite profile and runs one exercise check. *(builder to confirm GitHub Actions runner RAM is enough)*

## Left to the builder

- The bridge's implementation language. Python (FastAPI or the stdlib) is suggested so it can share code with `jifunze_lab`.
- Exact node versions, and how to share c-lightning's RPC socket with `runner` (a shared volume is suggested).
- The wording and number of exercises in each chapter, within the table above.
- (Answered) lnbook's single `LICENSE.md` is CC BY-SA 4.0 for the whole repository, including `code/docker`. Adapted lab files keep that licence and credit lnbook in `lab/README.md` and `ATTRIBUTIONS.md`; Jifunze's own lab code (bridge, runner helpers, checks) is MIT.

## Open (not blocking the build)

- The production site URL, for the bridge's origin allowlist. It uses the `lib/site.ts` value.
- Reviewers for the 17 lessons: one technical (Lightning) and one Kiswahili reviewer.
