"""Report whether bitcoind and each Lightning node answer. Exit 0 when all do."""
from __future__ import annotations

import json
import sys

from .clients import btc, client
from .nodes import nodes, profile


def status() -> dict:
    out: dict = {"profile": profile(), "nodes": {}}
    try:
        info = btc().call("getblockchaininfo")
        out["nodes"]["bitcoind"] = {"impl": "bitcoind", "ok": True, "blocks": info["blocks"]}
    except Exception as e:  # noqa: BLE001 - report any failure as not ok
        out["nodes"]["bitcoind"] = {"impl": "bitcoind", "ok": False, "error": str(e)[:200]}
    for node in nodes().values():
        try:
            c = client(node.name)
            out["nodes"][node.name] = {"impl": node.impl, "ok": True, "pubkey": c.pubkey}
        except Exception as e:  # noqa: BLE001
            out["nodes"][node.name] = {"impl": node.impl, "ok": False, "error": str(e)[:200]}
    return out


if __name__ == "__main__":
    s = status()
    print(json.dumps(s, indent=2))
    sys.exit(0 if all(n["ok"] for n in s["nodes"].values()) else 1)
