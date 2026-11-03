"""Run every exercise's model solution through the running lab's bridge, then its check.

    python lab/tests/smoke_solutions.py [--lite] [--only ch08-multihop,...]

Needs the lab running (lab/lab up). Reads the pairing code with `lab/lab pair --raw`
unless JIFUNZE_LAB_TOKEN is set. Exits 1 if any check fails.
"""
from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
URL = os.environ.get("JIFUNZE_LAB_URL", "http://127.0.0.1:7777")
ORIGIN = "http://localhost:4321"

# Run lessons in book order; within a lesson, in exercise-file order below.
ORDER = [
    "ch02-dina-invoice", "ch02-alice-pays", "ch03-open-channel", "ch03-mine", "ch03-pay-bob",
    "ch04-three-nodes", "ch05-fees", "ch05-backup", "ch07-funding-tx", "ch08-multihop",
    "ch08-preimage", "ch10-toy-onion", "ch11-graph", "ch12-pathfind", "ch13-parse-init",
    "ch14-peers", "ch15-decode", "ch16-probe", "ch09-coop-close", "ch09-force-close",
]


def token() -> str:
    if os.environ.get("JIFUNZE_LAB_TOKEN"):
        return os.environ["JIFUNZE_LAB_TOKEN"]
    out = subprocess.run(["bash", os.path.join(REPO, "lab", "lab"), "pair", "--raw"], capture_output=True, text=True, check=True)
    return out.stdout.strip()


def call(path: str, body: dict | None, tok: str, timeout: float = 300) -> object:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        URL + path,
        data=data,
        method="POST" if body is not None else "GET",
        headers={"Authorization": f"Bearer {tok}", "Origin": ORIGIN, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def main(argv: list[str]) -> int:
    lite = "--lite" in argv
    only = None
    if "--only" in argv:
        only = set(argv[argv.index("--only") + 1].split(","))
    exercises = {}
    for path in glob.glob(os.path.join(REPO, "content", "lightning", "exercises", "*.json")):
        with open(path, encoding="utf-8") as f:
            ex = json.load(f)
        exercises[ex["id"]] = ex
    tok = token()
    profile = call("/status", None, tok)["profile"]
    failed = []
    reset_done = set()
    for ex_id in ORDER:
        ex = exercises[ex_id]
        if only and ex_id not in only:
            continue
        if ex.get("profile") == "full" and (lite or profile != "full"):
            print(f"skip  {ex_id} (needs the full profile)")
            continue
        if ex["lesson"] not in reset_done:
            res = call("/reset", {"lesson": ex["lesson"]}, tok)
            reset_done.add(ex["lesson"])
            if not res["ok"]:
                print(f"FAIL  {ex_id}: reset {ex['lesson']}: {res['log'][-300:]}")
                failed.append(ex_id)
                continue
        run = call("/run", {"exercise": ex_id, "node": ex["node"], "tab": ex["tab"], "code": ex["solution"][ex["tab"]]}, tok)
        results = call("/check", {"exercise": ex_id}, tok)
        bad = [r for r in results if not r["pass"]]
        if bad:
            failed.append(ex_id)
            print(f"FAIL  {ex_id}: " + "; ".join(r["label"]["en"] for r in bad))
            print("      exit", run["exitCode"], "|", (run["stdout"] + run["stderr"])[-400:].replace("\n", " | "))
        else:
            print(f"pass  {ex_id} ({run['ms']} ms)")
    print(f"\n{len(failed)} failed" if failed else "\nall exercises pass")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
