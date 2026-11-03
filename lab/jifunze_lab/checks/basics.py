"""Chapters 2-5: first payments, channels, node software, node operations."""
from __future__ import annotations

import os

from . import ran_ok, result


def ch02_dina_invoice(lab, runs):
    invoices = lab.lnd("dina").invoices()
    return [
        ran_ok(runs),
        result(
            "invoice",
            "Dina ana ankara ya sats 50,000",
            "Dina has an invoice for 50,000 sats",
            any(int(i.get("value", 0)) == 50_000 for i in invoices),
        ),
    ]


def ch02_alice_pays(lab, runs):
    paid = [p for p in lab.lnd("alice").payments() if p["status"] == "SUCCEEDED" and int(p.get("value_sat", 0)) == 50_000]
    settled = [i for i in lab.lnd("dina").invoices() if i.get("state") == "SETTLED" and int(i.get("value", 0)) == 50_000]
    return [
        result("paid", "Alice amelipa sats 50,000", "Alice paid 50,000 sats", paid),
        result("settled", "Ankara ya Dina imelipwa", "Dina's invoice is settled", settled),
    ]


def _bob(lab):
    return lab.cln("bob").pubkey


def ch03_open_channel(lab, runs):
    bob = _bob(lab)
    return [
        ran_ok(runs),
        result("channel", "Alice ana chaneli (au chaneli inayosubiri) na Bob", "Alice has a channel (or a pending one) with Bob", lab.lnd("alice").has_channel_with(bob)),
    ]


def ch03_mine(lab, runs):
    bob = _bob(lab)
    return [
        result("active", "Chaneli ya Alice na Bob iko hai", "Alice's channel with Bob is active", lab.lnd("alice").active_channel_with(bob)),
    ]


def ch03_pay_bob(lab, runs):
    invoices = lab.cln("bob").listinvoices()["invoices"]
    paid = [i for i in invoices if i.get("status") == "paid" and int(i.get("amount_received_msat", 0)) >= 20_000_000]
    return [result("paid", "Bob amepokea sats 20,000", "Bob received 20,000 sats", paid)]


def ch04_three_nodes(lab, runs):
    out = "\n".join(r["stdout"] for r in runs if r["exitCode"] == 0)
    return [
        result("full", "Maabara iko kwenye wasifu kamili (Erin anaendesha Eclair)", "The lab is in the full profile (Erin runs Eclair)", lab.profile() == "full"),
        result("lnd", "Umepata jina la Alice kutoka LND", "You got Alice's alias from LND", '"alice"' in out),
        result("cln", "Umepata jina la Bob kutoka c-lightning", "You got Bob's alias from c-lightning", '"bob"' in out),
        result("eclair", "Umepata jina la Erin kutoka Eclair", "You got Erin's alias from Eclair", '"erin"' in out),
    ]


def ch05_fees(lab, runs):
    fees = lab.lnd("alice").fee_report().get("channel_fees", [])
    ok = bool(fees) and all(str(f.get("base_fee_msat")) == "1000" and str(f.get("fee_per_mil")) == "100" for f in fees)
    return [
        ran_ok(runs),
        result("fees", "Kila chaneli ya Alice inatoza 1 sat + 100 ppm", "Every Alice channel charges 1 sat + 100 ppm", ok),
    ]


def ch05_backup(lab, runs):
    path = "/tmp/alice-channels.backup"
    return [
        result("file", "Faili ya nakala ya chaneli ipo", "The channel backup file exists", os.path.exists(path) and os.path.getsize(path) > 0),
    ]


CHECKS = {
    "ch02-dina-invoice": ch02_dina_invoice,
    "ch02-alice-pays": ch02_alice_pays,
    "ch03-open-channel": ch03_open_channel,
    "ch03-mine": ch03_mine,
    "ch03-pay-bob": ch03_pay_bob,
    "ch04-three-nodes": ch04_three_nodes,
    "ch05-fees": ch05_fees,
    "ch05-backup": ch05_backup,
}
