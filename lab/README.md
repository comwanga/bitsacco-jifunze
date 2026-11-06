# Jifunze Lightning lab

A regtest Lightning network on your laptop for the **Lightning kwa Wajenzi** path. Lesson pages talk to it, so you can run the book's commands and your own Python from the browser. **Regtest only: nothing here touches real bitcoin.**

| Node | Software | Role in the lessons |
| --- | --- | --- |
| bitcoind | Bitcoin Core, regtest | The chain; you mine blocks on demand |
| Alice | LND | Pays, opens channels, probes |
| Bob | c-lightning | Routes, receives |
| Chan | c-lightning | Routes |
| Dina | LND | Receives, force-closes |
| Erin | Eclair (full profile only) | Chapter 4: comparing implementations |

The four-node topology follows *Mastering the Lightning Network*. The book runs Chan on Eclair. Native secp256k1 signing crashes were observed with Eclair 0.12–0.13 under Docker Desktop on Windows, so here Chan runs c-lightning and Eclair is a fifth node, Erin.

## Requirements

- Docker with Compose v2 (`docker compose`). On **Windows**, use Docker Desktop with the WSL2 backend and run everything inside a WSL2 terminal (Ubuntu), not Git Bash or PowerShell.
- 8 GB of RAM is recommended. The lite profile uses about 2 GB and the full profile about 3.5 GB.
- About 6 GB of free disk for the images.
- Port 7777 free.

## Commands

From the repository root, run `cd lab` first.

```bash
./lab doctor              # check this computer
./lab up                  # start the lite profile (first run downloads ~2 GB)
./lab up --full           # also start Erin (Eclair)
./lab pair                # show the pairing code for the lesson page
./lab reset <lesson>      # restore a lesson's starting channels (e.g. ./lab reset routing-htlcs)
./lab reset --hard route  # wipe the chain and rebuild from scratch
./lab logs [service]      # follow logs
./lab down                # stop (keeps data);  ./lab down -v  stops and deletes everything
```

## How the page talks to the lab

The `lab` container runs a small HTTP service, the **bridge**, published only on `127.0.0.1:7777`.

- The bridge answers only exact allowlisted origins: `JIFUNZE_ORIGINS` defaults to `https://bitsaccojifunze.xyz`, `https://staging.bitsaccojifunze.xyz`, `http://localhost:3000` and `http://localhost:4321`. Any other website gets 403. Codespaces passes the same list to the lab container; do not replace it with a wildcard.
- Operational requests except `GET /hello` need the **pairing code** from `./lab pair`. Browser preflight requests are origin-checked without a token. Ten wrong codes in a minute lock it for a minute.
- Your code runs inside the `lab` container as an unprivileged user (uid 1000), with a 30-second limit and 64 KB of output. The bridge has no Docker socket and no access to your files.

Opening a lesson does not probe localhost. Choose the lab check/connect action deliberately, then enter the pairing code. Chrome and Edge may request local-network permission at that point; declining does not prevent reading the lesson.

Learner code can reach the internet from the lab container; this is not an egress-isolated sandbox. Run only code you trust, keep the pairing code private, and do not mount personal files or wallet secrets. The origin allowlist and pairing protect bridge access; they do not make arbitrary learner code safe.

## In the editor

- **CLI tab:** `bitcoin-cli`, `lncli`, `lightning-cli` and `eclair-cli`, aimed at the node chosen in the lesson. Override with `JIFUNZE_NODE=dina lncli …`. Running the wrong CLI for a node prints which one to use.
- **Python tab:** `from jifunze_lab import btc, lnd, cln, eclair, client, probe`.

## GitHub Codespaces

The local WSL2/Docker lab is implemented and demonstrated. Codespaces is a separate setup path: the [devcontainer](../.devcontainer/devcontainer.json) is configured for 4 cores/8 GB, Docker-in-Docker, lab startup, forwarding port 7777 and printing the pairing code. The previous Codespaces attempt failed during Docker-in-Docker installation. A successful rebuild, automatic startup and end-to-end Jifunze connection have **not** been verified there.

After a successful devcontainer setup, inspect its startup output; if needed, run `cd lab`, `./lab doctor`, `./lab up` and `./lab pair`. The lesson page needs a **public** forwarded port 7777; private forwarding requires GitHub cookies that its cross-site requests cannot use. Make only that bridge port public in the Ports tab if the configured command fails, then enter its `https://…-7777.app.github.dev` URL in the lab bar's "Using Codespaces?" field and pair. Exact-origin checks and the pairing code still apply. Do not expose node RPC ports or use real funds.

## Troubleshooting

- **"Lab not found"**: is `./lab up` finished? Is port 7777 used by something else (`./lab doctor`)?
- **"That code is wrong"**: run `./lab pair` again; the code survives restarts but not `./lab down -v`.
- **A payment says no route, or a channel looks stuck**: press **Reset lesson**, or run `./lab reset <lesson>`. Resets reconnect peers, clear channels whose funding never confirmed, and wait until Alice can see every channel.
- **Erin keeps restarting**: Eclair needs the full profile's wallet. Run `./lab up --full` again; it unlocks leftover coins before Eclair starts.

## Development

```bash
# unit tests (run inside the lab image)
docker run --rm -v "$PWD/..:/repo" -w /repo/lab -e PYTHONPATH=/repo/lab jifunze/lab:local python -m unittest discover tests
# run every exercise's model solution through the bridge (lab must be up)
JIFUNZE_LAB_TOKEN="$(./lab pair --raw)" python3 tests/smoke_solutions.py [--lite]
```

## Credits

- Topology and exercises follow *Mastering the Lightning Network* by Andreas M. Antonopoulos, Olaoluwa Osuntokun and René Pickhardt (CC BY-SA 4.0).
- Node images: [Polar](https://github.com/jamaljsr/polar)'s regtest image definitions (MIT); bundled node software retains its respective upstream license.
- The bridge, CLI wrappers, `jifunze_lab` helpers and checks are Jifunze code (MIT).
