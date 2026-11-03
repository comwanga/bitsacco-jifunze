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

The four-node topology follows *Mastering the Lightning Network*. The book runs Chan on Eclair. Eclair's native signing library crashes under some Docker setups, so here Chan runs c-lightning and Eclair is a fifth node, Erin.

## Requirements

- Docker with Compose v2 (`docker compose`). On **Windows**, use Docker Desktop with the WSL2 backend and run everything inside a WSL2 terminal (Ubuntu), not Git Bash or PowerShell.
- 8 GB of RAM is recommended. The lite profile uses about 2 GB and the full profile about 3.5 GB.
- About 6 GB of free disk for the images.
- Port 7777 free.

## Commands

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

- The bridge answers only allowlisted origins: `JIFUNZE_ORIGINS`, by default the Jifunze site and `localhost` dev servers. Any other website gets 403.
- Every request except `/hello` needs the **pairing code** from `./lab pair`. Ten wrong codes in a minute lock it for a minute.
- Your code runs inside the `lab` container as an unprivileged user (uid 1000), with a 30-second limit and 64 KB of output. The bridge has no Docker socket and no access to your files.

The first time a lesson page calls the lab, Chrome and Edge may ask to "allow access to devices on your local network". Allow it for the Jifunze site.

## In the editor

- **CLI tab:** `bitcoin-cli`, `lncli`, `lightning-cli` and `eclair-cli`, aimed at the node chosen in the lesson. Override with `JIFUNZE_NODE=dina lncli …`. Running the wrong CLI for a node prints which one to use.
- **Python tab:** `from jifunze_lab import btc, lnd, cln, eclair, client, probe`.

## GitHub Codespaces

No suitable laptop? Open the repository in a Codespace (4 cores, 8 GB). The dev container starts the lab and prints the pairing code. Make port 7777 **public** in the Ports tab, if the start-up script couldn't do it, and paste the forwarded `https://…-7777.app.github.dev` URL into the lab bar's "Using Codespaces?" field. The pairing code still protects it.

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
- Node images: [Polar](https://github.com/jamaljsr/polar)'s regtest images (MIT).
- The bridge, CLI wrappers, `jifunze_lab` helpers and checks are Jifunze code (MIT).
