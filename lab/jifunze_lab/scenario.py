"""Lesson starting states. `ensure()` is idempotent: running it twice changes nothing.

Scenario JSON (lab/scenarios/<lesson>.json):
    {"base": "route", "fund": ["alice", ...],
     "channels": [{"from": "alice", "to": "bob", "sats": 1000000, "push": 300000}], "mine": 0}
"""
from __future__ import annotations

import json
import os
import sys
import time

NODE_NAMES = ("alice", "bob", "chan", "dina")
FUND_MIN_SATS = 50_000_000
FUND_SEND_BTC = 1


class ScenarioError(Exception):
    pass


def _dir() -> str:
    return os.environ.get("JIFUNZE_SCENARIOS", "/lab/scenarios")


def load(name: str, _seen: tuple = ()) -> dict:
    path = os.path.join(_dir(), f"{name}.json")
    if name in _seen:
        raise ScenarioError(f"scenario {name!r} inherits from itself")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError as e:
        raise ScenarioError(f"no scenario file {path} (lesson {name!r})") from e
    if "base" in data:
        base = load(data["base"], (*_seen, name))
        merged = {**base, **{k: v for k, v in data.items() if k != "base"}}
        if "channels" in data and "channels" in base and data.get("extend", True):
            merged["channels"] = base["channels"] + data["channels"]
        data = merged
    data.setdefault("fund", [])
    data.setdefault("channels", [])
    data.setdefault("mine", 0)
    for n in data["fund"]:
        if n not in NODE_NAMES:
            raise ScenarioError(f"{name}: unknown node {n!r} in fund")
    for ch in data["channels"]:
        if ch.get("from") not in NODE_NAMES or ch.get("to") not in NODE_NAMES:
            raise ScenarioError(f"{name}: channel needs from/to among {NODE_NAMES}")
        if ch["from"] == ch["to"]:
            raise ScenarioError(f"{name}: a node cannot open a channel to itself")
        if int(ch.get("sats", 0)) < 20_000:
            raise ScenarioError(f"{name}: channel sats must be at least 20000")
    return data


def _wait(what: str, predicate, timeout: float = 90, step: float = 1.0, nudge=None) -> None:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        try:
            if predicate():
                return
        except Exception:  # noqa: BLE001 - nodes may be briefly unavailable
            pass
        if nudge:
            nudge()
        time.sleep(step)
    raise ScenarioError(f"timed out waiting for {what}")


def _tx_known(b, txid: str) -> bool:
    try:
        b.call("getrawtransaction", txid)
        return True
    except Exception:  # noqa: BLE001 - unknown to the chain and the mempool
        return False


def _clear_zombies(b, log) -> None:
    from .clients import client
    from .nodes import nodes

    for node in nodes().values():
        c = client(node.name)
        if node.impl == "cln":
            for peer, channel_id, txid in c.pending_funding():
                if not _tx_known(b, txid):
                    log(f"Removing {node.name}'s channel whose funding was never broadcast…")
                    c.forget(peer, channel_id)
        elif node.impl == "lnd":
            for point in c.pending_funding_points():
                if not _tx_known(b, point.split(":")[0]):
                    log(f"Abandoning {node.name}'s pending channel whose funding was never broadcast…")
                    c.abandon(point)


def ensure(sc: dict, log=print) -> None:
    from .clients import btc, client

    b = btc()
    try:
        b.call("loadwallet", "lab")
    except Exception:  # noqa: BLE001 - already loaded
        pass
    if b.call("getblockcount") < 101:
        log("Mining 101 blocks so the lab wallet has spendable coins…")
        b.mine(101)

    sent = False
    for name in sc["fund"]:
        c = client(name)
        if c.onchain_sats() < FUND_MIN_SATS:
            log(f"Funding {name} with {FUND_SEND_BTC} BTC on-chain…")
            b.call("sendtoaddress", c.newaddress(), FUND_SEND_BTC, wallet="lab")
            sent = True
    if sent:
        b.mine(1)
        for name in sc["fund"]:
            _wait(f"{name} to see its funds", lambda n=name: client(n).onchain_sats() >= FUND_MIN_SATS, 60)

    # Let recent outputs (e.g. from a force close) mature before they are spent into new channels,
    # then clear channels whose funding transaction bitcoind never accepted.
    b.mine(1)
    _clear_zombies(b, log)

    not_active = []
    for ch in sc["channels"]:
        a, z = client(ch["from"]), client(ch["to"])
        zpub = z.pubkey
        if a.active_channel_with(zpub):
            continue
        if not a.has_channel_with(zpub):
            log(f"Opening a {ch['sats']:,}-sat channel {ch['from']} → {ch['to']}…")
            for attempt in range(4):
                try:
                    a.connect(zpub, ch["to"])
                    a.open_channel(zpub, int(ch["sats"]), int(ch.get("push", 0)))
                    break
                except Exception as e:  # noqa: BLE001 - a peer that just restarted may drop the first try
                    if attempt == 3 or not any(s in str(e) for s in ("not connected", "not online", "disconnected", "connection", "died")):
                        raise
                    time.sleep(3)
        not_active.append(ch)  # new, or opened earlier but never confirmed
    if not_active:
        b.mine(6)
        for ch in not_active:
            a, zpub = client(ch["from"]), client(ch["to"]).pubkey
            ticks = {"n": 0}

            def more_blocks() -> None:  # some implementations want extra confirmations
                ticks["n"] += 1
                if ticks["n"] % 10 == 0:
                    b.mine(1)

            _wait(
                f"channel {ch['from']} → {ch['to']} to become active",
                lambda a=a, zpub=zpub: a.active_channel_with(zpub),
                120,
                1.0,
                more_blocks,
            )
    if sc["mine"]:
        b.mine(int(sc["mine"]))
    involved = {c["from"] for c in sc["channels"]} | {c["to"] for c in sc["channels"]}
    if sc["channels"] and "alice" in involved:
        # Alice must hear about every scenario channel (by its two ends, with both fee policies)
        # before she can route over them. Counting edges is not enough: closed channels linger.
        pub = {n: client(n).pubkey for n in involved}
        want = {frozenset((pub[c["from"]], pub[c["to"]])) for c in sc["channels"]}
        ticks = {"n": 0}

        def usable(policy) -> bool:
            return bool(policy) and not policy.get("disabled")

        def known() -> bool:
            have = {
                frozenset((e["node1_pub"], e["node2_pub"]))
                for e in client("alice").graph().get("edges", [])
                if usable(e.get("node1_policy")) and usable(e.get("node2_policy"))
            }
            return want <= have

        def reconnect() -> None:
            # A peer that restarted leaves its channels disabled until the two reconnect.
            for c in sc["channels"]:
                try:
                    client(c["from"]).connect(pub[c["to"]], c["to"])
                except Exception:  # noqa: BLE001 - already connected is fine
                    pass

        reconnect()

        def nudge() -> None:
            ticks["n"] += 1
            if ticks["n"] % 10 == 0:
                b.mine(1)
                reconnect()

        _wait("Alice to learn the channel graph", known, 180, 2.0, nudge)
    log("Scenario ready.")


if __name__ == "__main__":
    lesson = sys.argv[1] if len(sys.argv) > 1 else "route"
    try:
        ensure(load(lesson))
    except ScenarioError as e:
        print(f"Scenario failed: {e}", file=sys.stderr)
        sys.exit(1)
