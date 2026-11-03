"""jifunze_lab: helpers for the Jifunze Lightning lab.

    from jifunze_lab import btc, lnd, cln, eclair, client
    invoice = lnd("dina").addinvoice(1000, "chai")["payment_request"]
"""
from .clients import LabClientError, btc, client, cln, eclair, lnd  # noqa: F401
from .nodes import nodes, profile  # noqa: F401
