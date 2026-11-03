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

    opened = []
    for ch in sc["channels"]:
        a, z = client(ch["from"]), client(ch["to"])
        zpub = z.pubkey
        if a.has_channel_with(zpub):
            continue
        log(f"Opening a {ch['sats']:,}-sat channel {ch['from']} → {ch['to']}…")
        a.connect(zpub, ch["to"])
        a.open_channel(zpub, int(ch["sats"]), int(ch.get("push", 0)))
        opened.append(ch)
    if opened:
        b.mine(6)
        for ch in opened:
            a, zpub = client(ch["from"]), client(ch["to"]).pubkey
            _wait(
                f"channel {ch['from']} → {ch['to']} to become active",
                lambda a=a, zpub=zpub: a.active_channel_with(zpub),
            )
    if sc["mine"]:
        b.mine(int(sc["mine"]))
    involved = {c["from"] for c in sc["channels"]} | {c["to"] for c in sc["channels"]}
    if sc["channels"] and "alice" in involved:
        # Alice must hear about every channel before she can route over them.
        want = len(sc["channels"])
        ticks = {"n": 0}

        def nudge() -> None:
            ticks["n"] += 1
            if ticks["n"] % 10 == 0:
                b.mine(1)

        _wait("Alice to learn the channel graph", lambda: len(client("alice").graph().get("edges", [])) >= want, 150, 2.0, nudge)
    log("Scenario ready.")


if __name__ == "__main__":
    lesson = sys.argv[1] if len(sys.argv) > 1 else "route"
    try:
        ensure(load(lesson))
    except ScenarioError as e:
        print(f"Scenario failed: {e}", file=sys.stderr)
        sys.exit(1)
