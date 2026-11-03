"""Run learner code (CLI or Python) as the unprivileged `learner` user, with a time and output limit."""
from __future__ import annotations

import os
import signal
import subprocess
import tempfile
import threading
import time

TABS = ("cli", "python")
TRUNCATED = "\n… [output truncated]"
LEARNER_UID = 1000


def _reader(stream, cap: int, out: dict, key: str) -> None:
    chunks: list[bytes] = []
    size = 0
    while True:
        block = stream.read(8192)
        if not block:
            break
        room = cap - size
        if room > 0:
            chunks.append(block[:room])
            size += min(len(block), room)
        if len(block) > max(room, 0):
            out["truncated"] = True  # keep draining so the process isn't blocked on a full pipe
    out[key] = b"".join(chunks)


def run(tab: str, code: str, node: str, *, timeout: float = 30, cap: int = 65536) -> dict:
    if tab not in TABS:
        raise ValueError(f"unknown tab {tab!r}; use cli or python")
    env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": "/home/learner" if os.path.isdir("/home/learner") else tempfile.gettempdir(),
        "LANG": "C.UTF-8",
        "PYTHONPATH": os.environ.get("PYTHONPATH", "/lab"),
        "PYTHONUNBUFFERED": "1",
        "JIFUNZE_NODE": "" if node == "none" else node,
    }
    for passthrough in ("LAB_PROFILE", "JIFUNZE_STATE", "JIFUNZE_NODES", "JIFUNZE_SCENARIOS", "BITCOIN_RPC_URL"):
        if passthrough in os.environ:
            env[passthrough] = os.environ[passthrough]

    script = None
    if tab == "cli":
        argv = ["bash", "-c", code]
    else:
        fd, script = tempfile.mkstemp(prefix="jifunze-", suffix=".py")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(code)
        os.chmod(script, 0o644)
        argv = ["python3", "-s", script]

    drop = os.geteuid() == 0 and os.environ.get("JIFUNZE_SAME_USER") != "1"
    start = time.monotonic()
    proc = subprocess.Popen(
        argv,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        cwd=env["HOME"],
        start_new_session=True,
        user=LEARNER_UID if drop else None,
        group=LEARNER_UID if drop else None,
        extra_groups=[] if drop else None,
    )
    out: dict = {"truncated": False}
    readers = [
        threading.Thread(target=_reader, args=(proc.stdout, cap, out, "stdout"), daemon=True),
        threading.Thread(target=_reader, args=(proc.stderr, cap, out, "stderr"), daemon=True),
    ]
    for t in readers:
        t.start()
    timed_out = False
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
    # Kill the whole process group, so background children can't keep running or writing.
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    proc.wait()
    for t in readers:
        t.join(timeout=2)
    if script:
        try:
            os.unlink(script)
        except OSError:
            pass

    def text(key: str) -> str:
        s = out.get(key, b"").decode("utf-8", errors="replace")
        return s + TRUNCATED if out["truncated"] and key == "stdout" else s

    return {
        "stdout": text("stdout"),
        "stderr": text("stderr"),
        "exitCode": -9 if timed_out else proc.returncode,
        "ms": int((time.monotonic() - start) * 1000),
        "timedOut": timed_out,
        "truncated": out["truncated"],
    }
