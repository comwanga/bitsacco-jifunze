"""Checks for lab exercises.

CHECKS maps an exercise id to fn(lab, runs) -> list of results, where each result is
{"id": str, "label": {"sw": str, "en": str}, "pass": bool} and `runs` is this session's runs of
that exercise ({node, tab, code, exitCode, stdout}), oldest first.
"""
from __future__ import annotations


def result(rid: str, sw: str, en: str, ok) -> dict:
    return {"id": rid, "label": {"sw": sw, "en": en}, "pass": bool(ok)}


def last_ok(runs: list, tab: str | None = None) -> dict | None:
    for r in reversed(runs):
        if r["exitCode"] == 0 and (tab is None or r["tab"] == tab):
            return r
    return None


def ran_ok(runs: list, tab: str | None = None) -> dict:
    return result("ran", "Msimbo wako umeendeshwa bila hitilafu", "Your code ran without errors", last_ok(runs, tab))


def harness(runs: list, suffix: str, marker: str = "HARNESS_OK") -> tuple[bool, str]:
    """Re-run the learner's latest Python with extra test code appended. Returns (passed, output)."""
    from ..runner import run

    latest = next((r for r in reversed(runs) if r["tab"] == "python"), None)
    if latest is None:
        return False, "no Python run yet"
    out = run("python", latest["code"] + "\n\n# --- Jifunze check ---\n" + suffix, latest["node"])
    text = out["stdout"] + out["stderr"]
    return marker in out["stdout"], text[-500:]


class Lab:
    """Node clients for checks."""

    def lnd(self, name: str):
        from ..clients import lnd

        return lnd(name)

    def cln(self, name: str):
        from ..clients import cln

        return cln(name)

    def btc(self):
        from ..clients import btc

        return btc()

    def client(self, name: str):
        from ..clients import client

        return client(name)

    def profile(self) -> str:
        from ..nodes import profile

        return profile()


from . import basics, internals, network, protocol  # noqa: E402

CHECKS: dict = {**basics.CHECKS, **internals.CHECKS, **network.CHECKS, **protocol.CHECKS}
