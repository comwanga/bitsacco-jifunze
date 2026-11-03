"""Small clients for the lab's nodes, so learners write Lightning code rather than connection setup."""
from __future__ import annotations

import base64
import os
from typing import Any

import requests

from .nodes import BITCOIN_RPC, ECLAIR_PASSWORD, Node, nodes


class LabClientError(RuntimeError):
    pass


class BitcoinRPC:
    def __init__(self, wallet: str | None = None):
        self.wallet = wallet

    def call(self, method: str, *params: Any, wallet: str | None = None) -> Any:
        w = wallet if wallet is not None else self.wallet
        url = BITCOIN_RPC["url"] + (f"/wallet/{w}" if w else "")
        r = requests.post(
            url,
            json={"jsonrpc": "1.0", "id": "jifunze", "method": method, "params": list(params)},
            auth=(BITCOIN_RPC["user"], BITCOIN_RPC["password"]),
            timeout=30,
        )
        body = r.json()
        if body.get("error"):
            raise LabClientError(f"bitcoind {method}: {body['error'].get('message')}")
        return body["result"]

    def __getattr__(self, method: str):
        if method.startswith("_"):
            raise AttributeError(method)
        return lambda *params: self.call(method, *params)

    def mine(self, blocks: int = 1) -> list[str]:
        address = self.call("getnewaddress", wallet="lab")
        return self.call("generatetoaddress", blocks, address)


class LndREST:
    def __init__(self, node: Node):
        if node.impl != "lnd":
            raise LabClientError(f"{node.name} runs {node.impl}, not LND")
        self.node = node
        self.base = f"https://{node.host}:8080"

    @property
    def _headers(self) -> dict[str, str]:
        with open(self.node.lnd_macaroon, "rb") as f:
            return {"Grpc-Metadata-macaroon": f.read().hex()}

    def get(self, path: str, **params: Any) -> Any:
        r = requests.get(self.base + path, headers=self._headers, params=params, verify=self.node.lnd_cert, timeout=60)
        return self._json(r)

    def post(self, path: str, body: dict | None = None) -> Any:
        r = requests.post(self.base + path, headers=self._headers, json=body or {}, verify=self.node.lnd_cert, timeout=60)
        return self._json(r)

    @staticmethod
    def _json(r: requests.Response) -> Any:
        try:
            data = r.json()
        except ValueError as e:
            raise LabClientError(f"LND returned {r.status_code}: {r.text[:200]}") from e
        if r.status_code >= 400:
            raise LabClientError(f"LND {r.status_code}: {data.get('message', data)}")
        return data

    @property
    def pubkey(self) -> str:
        return self.getinfo()["identity_pubkey"]

    def getinfo(self) -> dict:
        return self.get("/v1/getinfo")

    def newaddress(self) -> str:
        return self.get("/v1/newaddress", type="WITNESS_PUBKEY_HASH")["address"]

    def balance(self) -> dict:
        return self.get("/v1/balance/blockchain")

    def onchain_sats(self) -> int:
        return int(self.balance().get("confirmed_balance", 0))

    def has_channel_with(self, pubkey: str) -> bool:
        if any(c["remote_pubkey"] == pubkey for c in self.channels()):
            return True
        pending = self.pending_channels().get("pending_open_channels", [])
        return any(p["channel"]["remote_node_pub"] == pubkey for p in pending)

    def active_channel_with(self, pubkey: str) -> bool:
        return any(c["remote_pubkey"] == pubkey and c.get("active") for c in self.channels())

    def pending_funding_points(self) -> list[str]:
        return [p["channel"]["channel_point"] for p in self.pending_channels().get("pending_open_channels", [])]

    def abandon(self, channel_point: str) -> None:
        txid, index = channel_point.split(":")
        r = requests.delete(
            f"{self.base}/v1/channels/abandon/{txid}/{index}",
            headers=self._headers,
            params={"i_know_what_i_am_doing": "true"},
            verify=self.node.lnd_cert,
            timeout=60,
        )
        self._json(r)

    def addinvoice(self, sats: int, memo: str = "") -> dict:
        return self.post("/v1/invoices", {"value": str(sats), "memo": memo})

    def invoices(self) -> list[dict]:
        return self.get("/v1/invoices").get("invoices", [])

    def pay(self, invoice: str) -> dict:
        return self.post("/v1/channels/transactions", {"payment_request": invoice})

    def payments(self) -> list[dict]:
        return self.get("/v1/payments", include_incomplete="true").get("payments", [])

    def channels(self) -> list[dict]:
        return self.get("/v1/channels").get("channels", [])

    def pending_channels(self) -> dict:
        return self.get("/v1/channels/pending")

    def closed_channels(self) -> list[dict]:
        return self.get("/v1/channels/closed").get("channels", [])

    def peers(self) -> list[dict]:
        return self.get("/v1/peers").get("peers", [])

    def connect(self, pubkey: str, host: str) -> None:
        try:
            self.post("/v1/peers", {"addr": {"pubkey": pubkey, "host": host}, "perm": False})
        except LabClientError as e:
            if "already connected" not in str(e):
                raise

    def open_channel(self, pubkey: str, sats: int, push_sats: int = 0) -> dict:
        return self.post(
            "/v1/channels",
            {
                "node_pubkey": base64.b64encode(bytes.fromhex(pubkey)).decode(),
                "local_funding_amount": str(sats),
                "push_sat": str(push_sats),
            },
        )

    def graph(self) -> dict:
        return self.get("/v1/graph")

    def decode(self, invoice: str) -> dict:
        return self.get(f"/v1/payreq/{invoice}")

    def fee_report(self) -> dict:
        return self.get("/v1/fees")

    def probe(self, dest_pubkey: str, sats: int) -> bool:
        """Send a payment that can't settle (random hash). True if the amount reached the destination."""
        import secrets

        self.post("/v2/router/mc/reset", {})
        res = self.post(
            "/v1/channels/transactions",
            {
                "dest": base64.b64encode(bytes.fromhex(dest_pubkey)).decode(),
                "amt": str(sats),
                "payment_hash": base64.b64encode(secrets.token_bytes(32)).decode(),
                "final_cltv_delta": 40,
            },
        )
        err = (res.get("payment_error") or "").lower()
        return "incorrect" in err and "payment_details" in err  # reached Dina: she just did not know the hash


class ClnRPC:
    def __init__(self, node: Node):
        if node.impl != "cln":
            raise LabClientError(f"{node.name} runs {node.impl}, not c-lightning")
        from pyln.client import LightningRpc  # imported lazily: tests run without pyln

        self.node = node
        self.rpc = LightningRpc(node.cln_socket)

    def call(self, method: str, params: Any = None) -> Any:
        return self.rpc.call(method, params)

    def __getattr__(self, method: str):
        if method.startswith("_"):
            raise AttributeError(method)
        return getattr(self.rpc, method)

    @property
    def pubkey(self) -> str:
        return self.rpc.getinfo()["id"]

    def newaddress(self) -> str:
        return self.rpc.newaddr()["bech32"]

    def channels(self) -> list[dict]:
        return self.rpc.listpeerchannels()["channels"]

    def onchain_sats(self) -> int:
        outs = self.rpc.listfunds()["outputs"]
        return sum(int(o["amount_msat"]) // 1000 for o in outs if o.get("status") == "confirmed")

    def has_channel_with(self, pubkey: str) -> bool:
        live = ("CHANNELD_AWAITING_LOCKIN", "CHANNELD_NORMAL", "DUALOPEND_AWAITING_LOCKIN", "DUALOPEND_OPEN_INIT")
        return any(c["peer_id"] == pubkey and c["state"] in live for c in self.channels())

    def active_channel_with(self, pubkey: str) -> bool:
        return any(c["peer_id"] == pubkey and c["state"] == "CHANNELD_NORMAL" for c in self.channels())

    def pending_funding(self) -> list[tuple[str, str, str]]:
        """(peer_id, channel_id, funding_txid) for channels still waiting to lock in."""
        return [
            (c["peer_id"], c["channel_id"], c["funding_txid"])
            for c in self.channels()
            if c["state"] == "CHANNELD_AWAITING_LOCKIN"
        ]

    def forget(self, peer_id: str, channel_id: str) -> None:
        self.rpc.call("dev-forget-channel", {"id": peer_id, "channel_id": channel_id, "force": True})

    def connect(self, pubkey: str, host: str) -> None:
        self.connect_to(pubkey, host)

    def connect_to(self, pubkey: str, host: str) -> None:
        self.rpc.connect(pubkey, host, 9735)

    def open_channel(self, pubkey: str, sats: int, push_sats: int = 0) -> dict:
        # Regtest has no fee estimates; c-lightning's fallback can fall just under bitcoind's
        # minimum relay fee ("min relay fee not met"), so the funding is never broadcast.
        params: dict[str, Any] = {"id": pubkey, "amount": sats, "feerate": "2500perkw"}
        if push_sats:
            params["push_msat"] = push_sats * 1000
        return self.rpc.call("fundchannel", params)


class EclairREST:
    def __init__(self, node: Node):
        if node.impl != "eclair":
            raise LabClientError(f"{node.name} runs {node.impl}, not Eclair")
        self.node = node
        self.base = f"http://{node.host}:8080"

    def call(self, method: str, **params: Any) -> Any:
        r = requests.post(f"{self.base}/{method}", data=params, auth=("", ECLAIR_PASSWORD), timeout=60)
        try:
            data = r.json()
        except ValueError as e:
            raise LabClientError(f"Eclair returned {r.status_code}: {r.text[:200]}") from e
        if r.status_code >= 400:
            raise LabClientError(f"Eclair {r.status_code}: {data.get('error', data)}")
        return data

    @property
    def pubkey(self) -> str:
        return self.call("getinfo")["nodeId"]

    def newaddress(self) -> str:
        return self.call("getnewaddress")

    def channels(self) -> list[dict]:
        return self.call("channels")

    def onchain_sats(self) -> int:
        return int(self.call("onchainbalance").get("confirmed", 0))

    def has_channel_with(self, pubkey: str) -> bool:
        return any(c["nodeId"] == pubkey and c["state"] not in ("CLOSED", "CLOSING") for c in self.channels())

    def active_channel_with(self, pubkey: str) -> bool:
        return any(c["nodeId"] == pubkey and c["state"] == "NORMAL" for c in self.channels())

    def connect(self, pubkey: str, host: str) -> None:
        self.connect_to(pubkey, host)

    def connect_to(self, pubkey: str, host: str) -> None:
        self.call("connect", uri=f"{pubkey}@{host}:9735")

    def open_channel(self, pubkey: str, sats: int, push_sats: int = 0) -> dict:
        # Eclair caps the on-chain fee it will pay to open (default 1000 sats); regtest fees exceed it.
        params: dict[str, Any] = {"nodeId": pubkey, "fundingSatoshis": sats, "fundingFeeBudgetSatoshis": 20000}
        if push_sats:
            params["pushMsat"] = push_sats * 1000
        return self.call("open", **params)


def client(name: str):
    node = nodes().get(name)
    if node is None:
        raise LabClientError(f"unknown node {name!r}; choose alice, bob, chan or dina (erin: full profile)")
    return {"lnd": LndREST, "cln": ClnRPC, "eclair": EclairREST}[node.impl](node)


def btc(wallet: str | None = None) -> BitcoinRPC:
    return BitcoinRPC(wallet)


def lnd(name: str = "alice") -> LndREST:
    return LndREST(nodes()[name])


def cln(name: str = "bob") -> ClnRPC:
    return ClnRPC(nodes()[name])


def eclair(name: str = "erin") -> EclairREST:
    return EclairREST(nodes()[name])


def probe(sats: int, source: str = "alice", dest: str = "dina") -> bool:
    """Could `sats` travel from source to dest right now? Uses a fake payment hash, so nothing is paid."""
    return lnd(source).probe(client(dest).pubkey, int(sats))


def current_node() -> str:
    return os.environ.get("JIFUNZE_NODE", "")
