"""The lab's nodes: Alice and Dina (LND), Bob and Chan (c-lightning), and in the full profile Erin (Eclair).

The book runs Chan on Eclair. Eclair's native signing library crashes under some Docker setups, so
the lab keeps routing on c-lightning and adds Eclair as a fifth node for the chapter that compares
implementations."""
from __future__ import annotations

import os
from dataclasses import dataclass

STATE = os.environ.get("JIFUNZE_STATE", "/lab/state")
NODES_DIR = os.environ.get("JIFUNZE_NODES", "/lab/nodes")


@dataclass(frozen=True)
class Node:
    name: str
    impl: str  # "lnd" | "cln" | "eclair"
    host: str

    # Node data volumes are mounted read-only at /lab/nodes/<name>. Node processes and the lab's
    # `learner` user share uid 1000, so these files are readable without copying.
    @property
    def lnd_cert(self) -> str:
        return f"{NODES_DIR}/{self.name}/tls.cert"

    @property
    def lnd_macaroon(self) -> str:
        return f"{NODES_DIR}/{self.name}/data/chain/bitcoin/regtest/admin.macaroon"

    @property
    def cln_socket(self) -> str:
        return f"{NODES_DIR}/{self.name}/regtest/lightning-rpc"


def profile() -> str:
    env = os.environ.get("LAB_PROFILE")
    if env:
        return env
    try:
        with open(f"{STATE}/profile", encoding="utf-8") as f:
            return f.read().strip() or "lite"
    except OSError:
        return "lite"


def nodes() -> dict[str, Node]:
    table = {
        "alice": Node("alice", "lnd", "alice"),
        "bob": Node("bob", "cln", "bob"),
        "chan": Node("chan", "cln", "chan"),
        "dina": Node("dina", "lnd", "dina"),
    }
    if profile() == "full":
        table["erin"] = Node("erin", "eclair", "erin")
    return table


CLI_FOR = {"lnd": "lncli", "cln": "lightning-cli", "eclair": "eclair-cli"}
BITCOIN_RPC = {
    "url": os.environ.get("BITCOIN_RPC_URL", "http://bitcoind:18443"),
    "user": "jifunze",
    "password": "jifunze",
}
ECLAIR_PASSWORD = "jifunze"
