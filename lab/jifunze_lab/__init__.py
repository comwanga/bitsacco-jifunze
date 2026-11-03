"""jifunze_lab: helpers for the Jifunze Lightning lab.

    from jifunze_lab import btc, lnd, cln, eclair, client
    invoice = lnd("dina").addinvoice(1000, "chai")["payment_request"]
"""
from .nodes import nodes, profile  # noqa: F401

_CLIENTS = {"LabClientError", "btc", "client", "cln", "eclair", "lnd", "probe"}


def __getattr__(name: str):
    # Imported lazily so tooling and unit tests work without the lab's network libraries.
    if name in _CLIENTS:
        from . import clients

        return getattr(clients, name)
    raise AttributeError(name)
