"""Argument handling shared by the CLI wrappers in lab/bin."""
from __future__ import annotations

import json
import os
import sys

from .nodes import CLI_FOR, nodes


class CliTargetError(Exception):
    def __init__(self, message: str, code: int = 2):
        super().__init__(message)
        self.code = code


def parse_value(raw: str):
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return raw


def parse_cli_args(argv: list[str]) -> tuple[str, list | dict]:
    keyword = False
    rest = list(argv)
    while rest and rest[0].startswith("-"):
        flag = rest.pop(0)
        if flag in ("-k", "--keywords"):
            keyword = True
    if not rest:
        print("usage: <method> [params...]", file=sys.stderr)
        raise SystemExit(2)
    method, params = rest[0], rest[1:]
    if keyword:
        out: dict = {}
        for p in params:
            key, _, value = p.partition("=")
            out[key] = parse_value(value)
        return method, out
    return method, [parse_value(p) for p in params]


def target_node(default: str | None = None) -> str:
    return os.environ.get("JIFUNZE_NODE") or default or ""


def wrong_cli(cli: str, node_name: str) -> CliTargetError:
    table = nodes()
    node = table.get(node_name)
    fits = [n.name for n in table.values() if CLI_FOR[n.impl] == cli]
    if node is None:
        return CliTargetError(
            f"{cli}: choose a node first ({', '.join(fits)}). / Chagua nodi kwanza ({', '.join(fits)}).", 2
        )
    right = CLI_FOR[node.impl]
    return CliTargetError(
        f"{cli} talks to {', '.join(fits)}. {node.name} runs {node.impl}: use {right}.\n"
        f"{cli} inazungumza na {', '.join(fits)}. {node.name} inaendesha {node.impl}: tumia {right}.",
        2,
    )


def lncli_args(node_name: str) -> list[str]:
    node = nodes().get(node_name)
    if node is None or node.impl != "lnd":
        raise wrong_cli("lncli", node_name)
    return [
        f"--rpcserver={node.host}:10009",
        f"--tlscertpath={node.lnd_cert}",
        f"--macaroonpath={node.lnd_macaroon}",
        "--network=regtest",
    ]
