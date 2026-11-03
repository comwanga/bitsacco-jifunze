"""Chapters 13-16: wire protocol, encrypted transport, payment requests, security and privacy."""
from __future__ import annotations

import re

from . import harness, last_ok, ran_ok, result

INIT_HARNESS = """
import os as _os
for _gf, _f in ((b"", b"\\x0a\\x69\\xa2"), (b"\\x01", b""), (_os.urandom(3), _os.urandom(5))):
    _tlv = _os.urandom(4)
    _m = (16).to_bytes(2, "big") + len(_gf).to_bytes(2, "big") + _gf + len(_f).to_bytes(2, "big") + _f + _tlv
    _p = parse_init(_m)
    assert _p["type"] == 16, "type should be 16"
    assert _p["global_features"] == _gf, "global features are wrong"
    assert _p["features"] == _f, "features are wrong"
    assert _p["tlv"] == _tlv, "the TLV stream is wrong"
print("HARNESS_OK")
"""

DECODE_HARNESS = """
_cases = {"lnbcrt500u1pxyz": 50_000, "lnbc2500u1pxyz": 250_000, "lnbc20m1pxyz": 2_000_000,
          "lnbcrt1500n1pxyz": 150, "lnbc10n1pxyz": 1, "lnbcrt1m1pxyz": 100_000}
for _inv, _want in _cases.items():
    _got = amount_sats(_inv)
    assert _got == _want, f"{_inv}: expected {_want}, got {_got}"
print("HARNESS_OK")
"""


def ch13_parse_init(lab, runs):
    ok, _ = harness(runs, INIT_HARNESS)
    return [
        ran_ok(runs, "python"),
        result("fields", "parse_init inasoma kila sehemu kwa usahihi", "parse_init reads every field correctly", ok),
    ]


def ch14_peers(lab, runs):
    bob = lab.cln("bob").pubkey
    run = last_ok(runs, "cli")
    out = run["stdout"] if run else ""
    return [
        ran_ok(runs, "cli"),
        result("bob", "Umeona muunganisho wa Alice na Bob", "You saw Alice's connection to Bob", bob in out),
        result("bytes", "Umeona baiti zilizotumwa na kupokelewa", "You saw the bytes sent and received", "bytes_sent" in out),
    ]


def ch15_decode(lab, runs):
    ok, _ = harness(runs, DECODE_HARNESS)
    return [
        ran_ok(runs, "python"),
        result("amounts", "amount_sats inasoma kiasi cha kila aina ya ankara", "amount_sats reads every kind of amount", ok),
    ]


def ch16_probe(lab, runs):
    from ..clients import probe

    run = last_ok(runs, "python")
    m = re.search(r"max_sats:\s*(\d+)", run["stdout"]) if run else None
    if not m:
        return [ran_ok(runs, "python"), result("estimate", "Umechapisha max_sats", "You printed max_sats", False)]
    n = int(m.group(1))
    below, above = probe(n), probe(n + 20_000)
    return [
        ran_ok(runs, "python"),
        result("reaches", f"Sats {n:,} zinaweza kumfikia Dina", f"{n:,} sats can reach Dina", n > 0 and below),
        result("tight", "Makadirio yako yako ndani ya sats 20,000 za kikomo", "Your estimate is within 20,000 sats of the limit", not above),
    ]


CHECKS = {
    "ch13-parse-init": ch13_parse_init,
    "ch14-peers": ch14_peers,
    "ch15-decode": ch15_decode,
    "ch16-probe": ch16_probe,
}
