"""Chapters 7-9: payment channels, HTLC routing, channel operation."""
from __future__ import annotations

from . import last_ok, ran_ok, result


def ch07_funding_tx(lab, runs):
    run = last_ok(runs, "python")
    out = run["stdout"] if run else ""
    capacities = {c["capacity"] for c in lab.lnd("alice").channels()}
    return [
        ran_ok(runs, "python"),
        result("capacity", "Umeonyesha uwezo wa chaneli halisi", "You printed a real channel's capacity", any(c in out for c in capacities)),
        result(
            "script",
            "Umeonyesha aina ya hati (P2WSH au Taproot)",
            "You printed the script type (P2WSH or Taproot)",
            "witness_v0_scripthash" in out or "witness_v1_taproot" in out,
        ),
    ]


def ch08_multihop(lab, runs):
    good = []
    for p in lab.lnd("alice").payments():
        if p["status"] == "SUCCEEDED" and int(p.get("value_sat", 0)) == 21_000:
            for h in p.get("htlcs", []):
                if h.get("status") == "SUCCEEDED" and len(h["route"]["hops"]) >= 3:
                    good.append(p)
    return [
        result("paid", "Alice amemlipa Dina sats 21,000", "Alice paid Dina 21,000 sats", good),
        result("hops", "Malipo yamepita kupitia nodi mbili za kati", "The payment went through two intermediate nodes", good),
    ]


def ch08_preimage(lab, runs):
    run = last_ok(runs, "python")
    return [
        ran_ok(runs, "python"),
        result("match", "Hashi ya preimage inalingana na hashi ya malipo", "The preimage hashes to the payment hash", run and "match: True" in run["stdout"]),
    ]


def ch09_coop_close(lab, runs):
    bob = lab.cln("bob").pubkey
    closed = [c for c in lab.lnd("alice").closed_channels() if c["remote_pubkey"] == bob and c.get("close_type") == "COOPERATIVE_CLOSE"]
    return [result("coop", "Chaneli ya Alice na Bob imefungwa kwa ushirikiano", "Alice's channel with Bob closed cooperatively", closed)]


def ch09_force_close(lab, runs):
    dina = lab.lnd("dina")
    pending = dina.pending_channels().get("pending_force_closing_channels", [])
    closed = [c for c in dina.closed_channels() if c.get("close_type") == "LOCAL_FORCE_CLOSE"]
    return [
        result("forced", "Dina amefunga chaneli kwa nguvu", "Dina force-closed a channel", pending or closed),
        result(
            "timelock",
            "Pesa za Dina zinasubiri kufuli la muda kuisha",
            "Dina's funds are waiting for the timelock",
            any(int(p.get("blocks_til_maturity", 0)) > 0 for p in pending) or closed,
        ),
    ]


CHECKS = {
    "ch07-funding-tx": ch07_funding_tx,
    "ch08-multihop": ch08_multihop,
    "ch08-preimage": ch08_preimage,
    "ch09-coop-close": ch09_coop_close,
    "ch09-force-close": ch09_force_close,
}
