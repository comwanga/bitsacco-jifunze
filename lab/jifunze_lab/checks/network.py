"""Chapters 10-12: onion routing, gossip, pathfinding."""
from __future__ import annotations

import re

from . import harness, last_ok, ran_ok, result

ONION_HARNESS = """
import os as _os
_keys = [_os.urandom(8) for _ in range(3)]
_msg = b"jifunze-onion-check"
_onion = wrap(_msg, _keys)
assert _onion != _msg, "wrap() returned the message unchanged"
_x = _onion
for _k in _keys[:-1]:
    _x = peel(_x, _k)
    assert _x != _msg, "the message appeared before the last hop"
assert peel(_x, _keys[-1]) == _msg, "peeling every layer did not give back the message"
print("HARNESS_OK")
"""

PATH_HARNESS = """
from jifunze_lab import lnd as _lnd
_g = _lnd("alice").graph()
_a, _d = _lnd("alice").pubkey, _lnd("dina").pubkey
_r = find_route(_g, _a, _d, 10_000_000)
assert _r and _r[0] == _a and _r[-1] == _d, "route must start at Alice and end at Dina"
_pairs = {(e["node1_pub"], e["node2_pub"]) for e in _g["edges"]} | {(e["node2_pub"], e["node1_pub"]) for e in _g["edges"]}
assert all((x, y) in _pairs for x, y in zip(_r, _r[1:])), "every step must follow a real channel"
print("HARNESS_OK")
"""


def ch10_toy_onion(lab, runs):
    ok, _ = harness(runs, ONION_HARNESS)
    return [
        ran_ok(runs, "python"),
        result("layers", "Kila hatua inaondoa safu moja tu", "Each hop removes exactly one layer", ok),
        result("message", "Dina anapata ujumbe kamili mwishoni", "Dina gets the whole message at the end", ok),
    ]


def ch11_graph(lab, runs):
    run = last_ok(runs, "python")
    out = run["stdout"] if run else ""
    g = lab.lnd("alice").graph()
    nodes = re.search(r"nodes:\s*(\d+)", out)
    chans = re.search(r"channels:\s*(\d+)", out)
    return [
        ran_ok(runs, "python"),
        result("nodes", "Idadi ya nodi ni sahihi", "The node count is right", nodes and int(nodes.group(1)) == len(g["nodes"])),
        result("channels", "Idadi ya chaneli ni sahihi", "The channel count is right", chans and int(chans.group(1)) == len(g["edges"])),
    ]


def ch12_pathfind(lab, runs):
    ok, _ = harness(runs, PATH_HARNESS)
    return [
        ran_ok(runs, "python"),
        result("route", "find_route inapata njia halisi kutoka Alice hadi Dina", "find_route finds a real route from Alice to Dina", ok),
    ]


CHECKS = {
    "ch10-toy-onion": ch10_toy_onion,
    "ch11-graph": ch11_graph,
    "ch12-pathfind": ch12_pathfind,
}
