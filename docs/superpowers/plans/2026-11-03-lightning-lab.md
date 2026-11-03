# Lightning kwa Wajenzi + live lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third Jifunze path with 17 simplified lessons, one per chapter of *Mastering the Lightning Network*. Lessons have an in-page CLI/Python editor that runs code against a regtest Lightning lab in Docker on the learner's laptop, with automatic checks.

**Architecture:** `lab/` holds a Docker Compose lab built from Polar's regtest images: bitcoind, Alice and Dina on LND, Bob and Chan on c-lightning (Chan on Eclair in the full profile), plus one `lab` container. The `lab` container runs (a) the **bridge**, a stdlib-Python HTTP server on `127.0.0.1:7777` with pairing-token auth and an origin allowlist, and (b) the learner's code as an unprivileged user, with CLI wrappers and the `jifunze_lab` helper package. There is no Docker socket. The site gains an `<Exercise>` MDX component whose small client island talks to the bridge. The CSP allows that connection only on pages that contain an exercise.

**Tech Stack:**
- Existing: Next.js 16, React 19, TypeScript, Vitest.
- Lab: Docker Compose v2; Polar images (`polarlightning/bitcoind:29.0`, `lnd:0.20.0-beta`, `clightning:25.09.3`, `eclair:0.13.1`).
- Lab Python: Python 3.12 with `pyln-client` and `requests`; tests use stdlib `unittest`.

**Spec:** `docs/superpowers/specs/2026-11-03-lightning-lab-design.md` (approved), on top of `Bitsacco Jifunze — v1 Spec.md`.

## Global Constraints

- Regtest only; no real funds; no real seed phrases.
- The bridge binds `127.0.0.1:7777` on the host (compose `ports: ["127.0.0.1:7777:7777"]`). Every endpoint except `GET /hello` requires `Authorization: Bearer <pairing code>`. Requests whose `Origin` isn't allowlisted get 403 with no CORS headers.
- Learner code runs as the non-root `learner` user inside `lab`, with a 30 s timeout and a 64 KB output cap. The bridge never mounts `/var/run/docker.sock`.
- Default (lite) profile fits in about 2 GB RAM; the full profile swaps Chan to Eclair.
- Editor tabs are **CLI** and **Python** only.
- Every lightning lesson's `source` credits *Mastering the Lightning Network*: `from: "Mastering the Lightning Network"`, `url: "https://github.com/lnbook/lnbook"`, `licence: "CC BY-SA 4.0"`, `credit: "Andreas M. Antonopoulos, Olaoluwa Osuntokun and René Pickhardt"`.
- Kiswahili first; every lesson in `sw` and `en`; all existing CI rules still apply.
- Pages without an exercise keep today's CSP and JS weight. Lab pages stay under the 150 KB JS ceiling.

## Review Focus

1. **A malicious website calls the bridge.** No allowlisted Origin means 403; no token means 401. A wrong token gets 401 and is rate-limited to 10 failed attempts a minute (unit tests in Task 3).
2. **Learner code hangs or prints forever.** It's killed at 30 s with `timedOut: true`, and output is truncated at 64 KB with a marker (unit tests in Task 3).
3. **The lab isn't running, or the token is stale.** The lab panel shows "Lab not found" or "Pair again" in the page language, never a raw fetch error, and the starter code stays visible (Task 6).
4. **A command targets the wrong node type** (`lncli` on Bob). The wrapper prints a one-line explanation of which CLI fits which node and exits 2 (unit test in Task 2).
5. **A progress file with a `lab` field is imported into the existing site.** The import keeps `lab.passed`, and older files without it still import (tests in Task 5).

---

## File Structure

```
lab/
  lab                          # bash: up [--full] | down | reset [--hard] <chapter> | pair | doctor | logs
  compose.yml                  # services + profiles (lite default, full)
  versions.env                 # pinned image tags
  Dockerfile                   # the "lab" container: python, lncli, shims, jifunze_lab, bridge
  README.md                    # setup (Windows/WSL2, macOS, Linux), credits lnbook
  bin/lncli-wrap  bin/lightning-cli  bin/eclair-cli  bin/bitcoin-cli   # CLI wrappers/shims (Python or sh)
  jifunze_lab/__init__.py      # btc(), lnd(name), cln(name), eclair(name), node registry
  jifunze_lab/nodes.py         # node table: name -> impl, host, ports, cred paths
  jifunze_lab/clients.py       # BitcoinRPC, LndREST, ClnRPC, EclairREST
  jifunze_lab/cli.py           # arg parsing shared by shims
  jifunze_lab/scenario.py      # ensure(scenario): fund, connect, open channels, wait active
  jifunze_lab/bridge.py        # HTTP server
  jifunze_lab/runner.py        # run(tab, code, node) -> RunResult (subprocess as learner)
  jifunze_lab/checks/__init__.py  + chNN.py   # CHECKS = {"chNN-x": fn(lab, runs) -> list[Result]}
  scenarios/<slug>.json        # per-lesson starting state
  tests/test_*.py              # unittest
.devcontainer/devcontainer.json
lib/lab/client.ts  lib/lab/useLab.ts            # bridge client + connection store
components/lab/Exercise.tsx (server)  components/lab/ExerciseRunner.tsx (client)  components/lab/LabBar.tsx (client)
content/roadmaps/lightning.json  content/lightning/{sw,en}/<slug>.mdx  content/quizzes/lightning/<slug>.json
content/lightning/exercises/<id>.json
```

## Shared Interfaces

```ts
// lib/content/schemas.ts additions
ROADMAP_IDS = ["savers", "builders", "lightning"]
export type ExerciseFile = { id: string; lesson: string; title: Localized; node: "alice"|"bob"|"chan"|"dina"|"none";
  tab: "cli"|"python"; profile?: "full"; starter: { cli?: string; python?: string }; solution: { cli?: string; python?: string } };
// lib/content/load.ts
export function getExercise(id: string, root?: string): ExerciseFile;
// lib/progress/model.ts
export type LessonProgress = { completedAt?: string; quiz?: QuizScore; lab?: { passed: string[] } };
export function recordLabPass(p: Progress, key: LessonKey, exerciseId: string, allIds: string[], now: string): Progress; // marks complete when all pass
// lib/lab/client.ts
export type LabConfig = { url: string; token: string };
export type RunResult = { stdout: string; stderr: string; exitCode: number; ms: number; timedOut: boolean; truncated: boolean };
export type CheckResult = { id: string; label: Localized; pass: boolean };
export function hello(url: string): Promise<{ lab: string; version: string } | null>;
export function status(c: LabConfig): Promise<{ profile: "lite"|"full"; nodes: Record<string, { impl: string; ok: boolean }> }>;
export function run(c: LabConfig, body: { exercise: string; node: string; tab: "cli"|"python"; code: string }): Promise<RunResult>;
export function check(c: LabConfig, exercise: string): Promise<CheckResult[]>;
export function reset(c: LabConfig, lesson: string): Promise<{ ok: boolean; log: string }>;
export class LabError extends Error { kind: "not-found"|"unauthorized"|"forbidden"|"server" }
```

```python
# lab/jifunze_lab
NODES: dict[str, Node]  # Node(name, impl in {"lnd","cln","eclair"}, host, ...)
def run(tab: str, code: str, node: str, *, timeout=30, cap=65536) -> dict  # RunResult fields above
class Bridge: handle(method, path, headers, body) -> (status, headers, body)   # pure, testable
# checks: fn(lab: Lab, runs: list[dict]) -> list[dict(id, label={sw,en}, pass)]
# runs = this session's runs for the exercise: {node, tab, code, exitCode, stdout}
```

---

### Task 1: Lab containers and the `lab` script

**Files:** `lab/compose.yml`, `lab/versions.env`, `lab/Dockerfile`, `lab/lab`, `lab/README.md`, `lab/bin/*`, `lab/jifunze_lab/nodes.py`, `lab/jifunze_lab/clients.py`.

- Compose: network `ln`. bitcoind uses `-regtest -txindex -fallbackfee=0.0002`, rpcuser/rpcpassword `jifunze`/`jifunze`, and zmq on 28334/28335. alice and dina: `polarlightning/lnd` with `--noseedbackup --bitcoin.regtest --bitcoin.node=bitcoind --restlisten=0.0.0.0:8080 --tlsextradomain=<name>`. bob and `chan-cln` (profile `lite`): `polarlightning/clightning` with `--network=regtest`. `chan-eclair` (profile `full`) has network alias `chan`, `--api.enabled --api.password=jifunze`, and its own bitcoind wallet `chan`. The `lab` service mounts each node's data dir **read-only** at `/lab/nodes/<name>`. `lab/lab up` passes `--profile lite` unless `--full`, and writes `LAB_PROFILE` to `/lab/state/profile`.
- `lab/Dockerfile`: `python:3.12-slim`. Copy `lncli` from the lnd image (`COPY --from`). `pip install pyln-client==25.9.* requests`. Install `bin/*` to `/usr/local/bin`. `useradd learner`. The bridge runs as `bridge`, a separate user that can `sudo -u learner` only for `runner` (or uses `setpriv`).
- Wrappers: `lncli` maps `$JIFUNZE_NODE` (`alice`/`dina`) to the right `--rpcserver`/cert/macaroon and refuses other nodes (Review Focus 4). `lightning-cli` is a pyln shim using `/lab/nodes/<node>/regtest/lightning-rpc` and supports positional and `-k key=value` args. `eclair-cli` is an HTTP form POST to `chan:8080`. `bitcoin-cli` is a JSON-RPC shim that ignores `-regtest`/`-rpcwallet=` handling flags but honours `-rpcwallet` and `-generate N`.
- `lab doctor`: RAM (≥ 6 GB total for lite, warn below), free disk ≥ 6 GB, `docker compose version`, port 7777 free, and on Windows a hint to run inside WSL2.

- [ ] **Step 1:** Unit tests `lab/tests/test_cli.py`: `parse_cli_args(["invoice","1000","lbl","desc"])` gives positional params; `["-k","invoice","amount_msat=1000","label=x"]` gives a dict; `lncli` target check gives exit code 2 and a message naming `lightning-cli` when `JIFUNZE_NODE=bob`.
- [ ] **Step 2:** `python -m unittest discover lab/tests` FAILs, then implement, then PASS.
- [ ] **Step 3:** `lab/lab up` → within 120 s `docker compose ps` shows all lite services healthy; `docker compose exec lab sh -c 'JIFUNZE_NODE=alice lncli getinfo && JIFUNZE_NODE=bob lightning-cli getinfo && bitcoin-cli getblockchaininfo'` gives three JSON outputs.
- [ ] **Step 4:** Commit `feat(lab): regtest Lightning lab with lite/full profiles and CLI wrappers`.

### Task 2: `jifunze_lab` clients, runner and scenarios

**Files:** `lab/jifunze_lab/{__init__,runner,scenario}.py`, `lab/scenarios/*.json`, `lab/tests/test_runner.py`, `lab/tests/test_scenario.py`.

- `btc()`, `lnd(name)`, `cln(name)` and `eclair(name)` return thin clients with `.call(method, **params)` plus a few helpers (`lnd().addinvoice(sats, memo)`, `.pay(invoice)`, `.channels()`, `.graph()`; `cln().invoice(...)`, `.pay(...)`, `.channels()`). Each also has `.pubkey`.
- `run(tab, code, node)`: CLI uses `bash -c code`; Python writes a temp file and runs `python3 -I`, with `PYTHONPATH=/lab`. Both get `JIFUNZE_NODE=node`, run as `learner`, time out at 30 s (the process group is killed) and cap output at 64 KB, appending `\n… [output truncated]`.
- Scenario JSON: `{ "fund": ["alice","bob","chan","dina"], "channels": [{"from":"alice","to":"bob","sats":1000000,"push":0}], "mine": 6 }`. `ensure()` is idempotent: it mines 101 blocks to a `lab` wallet if needed, tops each node up to ≥ 0.5 BTC on-chain, connects peers, opens missing channels, mines, and waits until they're active (90 s timeout, clear error).
- Base scenarios: `route` (alice→bob→chan→dina, 1 M sats each, 300 k pushed back on each hop), `funded` (no channels), and `pair` (alice↔bob only). Each lesson's scenario file names one of these or its own.

- [ ] **Step 1: Failing tests:** `run("python","print(1)", "none")` → stdout `1\n`, exit 0. `run("cli","sleep 40","none", timeout=1)` → `timedOut: true` in < 3 s (Review Focus 2). `run("cli","yes | head -c 200000","none")` → `truncated: true`, stdout length ≤ 65536 + marker. A scenario loader rejects unknown node names.
- [ ] **Step 2:** FAIL → implement → PASS (runs on the host with `learner` switching disabled via `JIFUNZE_SAME_USER=1` in tests).
- [ ] **Step 3:** In the running lab, `lab/lab reset route` succeeds, and `lncli` on alice shows 1 active channel; running it twice is a no-op.
- [ ] **Step 4:** Commit `feat(lab): runner with limits, node clients and idempotent scenarios`.

### Task 3: Bridge

**Files:** `lab/jifunze_lab/bridge.py`, `lab/tests/test_bridge.py`.

- `Bridge(token, origins, run_fn, check_fn, reset_fn, status_fn, clock)` with `handle(method, path, headers, body)`. It's pure, and the HTTP server is a thin `ThreadingHTTPServer` adapter.
- `GET /hello` → `{"lab":"jifunze","version":"1"}` (origin check applies; no token needed).
- `GET /status`, `POST /run`, `POST /check`, `POST /reset` need the token. `/run` validates `tab ∈ {cli,python}`, `node ∈ NODES ∪ {none}`, and `code ≤ 20 KB`, then appends to the session run log keyed by exercise (last 20 kept). `/check` calls `CHECKS[exercise](lab, runs[exercise])`; an unknown exercise gives 404.
- CORS: an allowlisted Origin gets `Access-Control-Allow-Origin: <origin>`, `Vary: Origin`, `Access-Control-Allow-Headers: authorization, content-type`, `Access-Control-Allow-Methods: GET, POST`, and `Access-Control-Allow-Private-Network: true` on preflight. Allowlist from env `JIFUNZE_ORIGINS` (comma-separated); default `https://jifunze.bitsacco.com,http://localhost:3000,http://localhost:4321`.
- Pairing: the token is 12 base32 chars, generated on first start into `/lab/state/token`. `lab pair` prints it formatted as `XXXX-XXXX-XXXX`; the bridge accepts it with or without dashes, case-insensitive.

- [ ] **Step 1: Failing tests (Review Focus 1, 2):** disallowed Origin → 403 and no ACAO header; preflight from an allowed Origin → 204 with PNA header; `/status` without a token → 401; with `abcd-efgh-ijkl` while the token is `ABCDEFGHIJKL` → 200; 11 bad tokens within 60 s → 429; `/run` with `tab:"rust"` → 400; `/run` code > 20 KB → 413; `/check` for an unknown id → 404; the run log keeps only the last 20.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** In the lab, `curl -H "Origin: http://localhost:4321" -H "Authorization: Bearer $(lab/lab pair --raw)" localhost:7777/status` returns all nodes ok.
- [ ] **Step 4:** Commit `feat(lab): authenticated, origin-locked bridge`.

### Task 4: Checks for every exercise

**Files:** `lab/jifunze_lab/checks/*.py`, `lab/tests/test_checks_static.py`.

- Exercise ids (20): `ch02-dina-invoice`, `ch02-alice-pays`, `ch03-open-channel`, `ch03-pay-bob`, `ch04-three-nodes` (full), `ch05-fees`, `ch05-backup`, `ch07-funding-tx`, `ch08-multihop`, `ch08-preimage`, `ch09-coop-close`, `ch09-force-close`, `ch10-toy-onion`, `ch11-graph`, `ch12-pathfind`, `ch13-parse-init`, `ch14-peers`, `ch15-decode`, `ch16-probe`, plus `ch03-mine` (mine 6 blocks so the channel confirms).
- State checks query the nodes (for example "Dina has a settled invoice ≥ 50,000 sats"). Run-based checks use `runs` (for example "you ran `getinfo` on an LND, a c-lightning and an Eclair node with exit 0"). Code-harness checks (ch10, ch12, ch13, ch15, ch16) re-run the learner's last Python code with an appended harness in `runner.run` and assert on the result.
- Labels are bilingual `{sw,en}` and phrased as outcomes.

- [ ] **Step 1:** Failing static test: every id above is a key in `CHECKS`, and every check returns ≥ 1 result with `label.sw` and `label.en`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** In the lab, run each exercise's **model solution** (from Task 7's exercise files) through `/run`, then `/check`, and confirm every result passes. Do this in a script, `lab/tests/smoke_solutions.py`, which CI also runs.
- [ ] **Step 4:** Commit `feat(lab): checks for all lightning exercises`.

### Task 5: Content model: third roadmap, exercises, lab progress, validation

**Files:** `lib/content/schemas.ts`, `lib/content/load.ts`, `lib/content/validate.ts`, `lib/progress/model.ts`, `lib/i18n.ts`, tests.

- Add `"lightning"` to `ROADMAP_IDS`; the progress key regex accepts it; add the `ExerciseFileSchema` and `getExercise()`.
- `recordLabPass()` adds the id once, and sets `completedAt` when every id in `allIds` has passed. `parseProgressFile` keeps `lab.passed` (array of strings) and rejects a non-array.
- Validator rule 6 (errors): every `<Exercise id="…">` in a lightning lesson has `content/lightning/exercises/<id>.json` with `lesson` equal to that slug and a starter for its `tab`, and the id appears in `lab/jifunze_lab/checks/*.py`. A missing solution is a warning.
- i18n keys for the lab panel (pair, status, run, reset, checks, errors, "use a laptop", the local-network permission note), plus `branchLightning`.

- [ ] **Step 1: Failing tests:** `recordLabPass` twice is idempotent; the last id sets `completedAt`. Import of `{lab:{passed:["x"]}}` keeps it; `{lab:{passed:"x"}}` → `invalid-shape` (Review Focus 5). Validator: an `<Exercise id="nope">` → rule 6 error; an exercise whose `lesson` doesn't match → error. Fixture lightning roadmap loads.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit `feat(content): lightning roadmap, exercises and lab progress`.

### Task 6: Lab panel in the lesson page

**Files:** `lib/lab/client.ts`, `lib/lab/useLab.ts`, `components/lab/*`, `components/mdx/components.tsx`, `app/[lang]/[roadmap]/[lesson]/page.tsx`, `lib/build/csp.ts`, `scripts/postbuild.ts`, tests.

- `client.ts` uses `fetch` with a 35 s `AbortController` and maps failures to `LabError.kind`: network error → `not-found`, 401 → `unauthorized`, 403 → `forbidden`, other → `server`.
- `useLab` keeps `{url, token}` in `localStorage['jifunze:lab']`, inside try/catch. It polls `/status` every 15 s while the tab is visible and exposes `{state: "checking"|"absent"|"unpaired"|"ready", status, pair(code), forget()}`.
- `<Exercise id>` server component: reads the exercise file and renders a card with the title, profile badge, node and starter code, plus `data-jifunze-lab` on the root and the `ExerciseRunner` island. With no connected lab, the island shows the starter as read-only plus the connect instructions; on screens under 900 px it adds "use a laptop".
- `ExerciseRunner`: CLI/Python tabs (only those the exercise has a starter for), a node select defaulting to `node`, a `<textarea>` (Tab inserts two spaces, Ctrl/⌘+Enter runs), Run, Check, Reset lesson, an output `<pre>`, and a checks list. When all checks pass it calls `recordLabPass`. Code edits are kept per exercise in `sessionStorage`.
- `LabBar` (sticky at the top of a lightning lesson): status chips per node, the profile, a pairing-code input, and the Codespaces URL field.
- CSP: `buildCsp(hashes, { lab: true })` adds `connect-src 'self' http://127.0.0.1:7777 http://localhost:7777 https://*.app.github.dev`. postbuild passes `lab: html.includes("data-jifunze-lab")`.
- Lightning lessons use a wider article (`max-w-[84ch]`).

- [ ] **Step 1: Failing tests:** `buildCsp([], {lab:true})` contains `http://127.0.0.1:7777` and the default doesn't. `client.run` against a stub `fetch` → a 401 maps to `LabError("unauthorized")` and a `TypeError` maps to `not-found` (Review Focus 3).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Build with the fixture lightning lesson. The HTML has `data-jifunze-lab` and its CSP includes 127.0.0.1; a savers lesson's CSP doesn't. Lab pages are ≤ 150 KB JS.
- [ ] **Step 4:** Manual: with the lab up and `npm run build` served on :4321, pair, run the `ch02-dina-invoice` solution, Check → all pass, and the roadmap tick appears.
- [ ] **Step 5:** Commit `feat(lab): exercise runner and lab bar in lesson pages`.

### Task 7: Lightning content (17 lessons × sw + en, quizzes, 20 exercises)

**Files:** `content/roadmaps/lightning.json`, `content/lightning/{sw,en}/*.mdx`, `content/quizzes/lightning/*.json`, `content/lightning/exercises/*.json`, `lab/scenarios/*.json`, `content/glossary.json` (new terms: `htlc`, `preimage`, `onion-routing`, `gossip`, `liquidity`, `commitment-transaction`, `force-close`, `probing`, `bolt11`, `gateway`).

Slugs (from lnbook files): `introduction`, `getting-started`, `how-ln-works`, `node-software`, `node-operations`, `architecture`, `payment-channels`, `routing-htlcs`, `channel-operation`, `onion-routing`, `gossip-channel-graph`, `pathfinding`, `wire-protocol`, `encrypted-transport`, `payment-requests`, `security-privacy`, `conclusion`.

Sections: **Misingi** (1–3), **Nodi** (4–5), **Ndani ya Lightning** (6–9), **Mtandao** (10–12), **Itifaki** (13–15), **Usalama na hatua inayofuata** (16–17).

Each lesson simplifies its chapter in 350–600 words (no copied passages) and credits lnbook in `source` plus a resource link to the chapter file on GitHub and the Kujifunza Bitcoin chapter 14. It has `<Exercise>` blocks where the design table says, 4 quiz questions, `level: intermediate` (1–3 `beginner`), and a "Lab" note naming the scenario. Chapter 4 says "start the full profile".

- [ ] **Step 1:** Write content + exercises + scenarios.
- [ ] **Step 2:** `npm run validate` → 0 errors.
- [ ] **Step 3:** `python lab/tests/smoke_solutions.py` → all 20 exercises pass in the lab (full profile for ch04).
- [ ] **Step 4:** `npm run build` passes all gates.
- [ ] **Step 5:** Commit `content(lightning): Lightning kwa Wajenzi, 17 lessons with lab exercises`.

### Task 8: Codespaces, CI, docs

**Files:** `.devcontainer/devcontainer.json`, `.github/workflows/ci.yml` (new `lab` job), `lab/README.md`, `README.md`, `ATTRIBUTIONS.md`, `CONTRIBUTING.md`.

- devcontainer: the docker-in-docker feature; `postStartCommand: lab/lab up && lab/lab pair`; `forwardPorts: [7777]` with `portsAttributes."7777".visibility: "public"`; set `JIFUNZE_ORIGINS` to include the site URL.
- CI `lab` job: `python -m unittest discover lab/tests`, then `lab/lab up`, `lab/lab reset route`, and `python lab/tests/smoke_solutions.py --lite` (skips the full-only ch04).
- ATTRIBUTIONS: Mastering the Lightning Network (CC BY-SA 4.0, authors) for the 17 lessons, the four-node Alice/Bob/Chan/Dina topology and the Docker lab layout; Polar images (MIT) as the node images.
- CONTRIBUTING: how to add an exercise (JSON + check + solution + smoke).

- [ ] **Step 1:** `docker compose -f lab/compose.yml config` is valid; the unit tests pass; the full local smoke passes.
- [ ] **Step 2:** Commit `ci: lab unit tests and smoke run; Codespaces lab`.
