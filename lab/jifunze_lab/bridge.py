"""The lab bridge: lets a Jifunze lesson page run code against this lab.

Security model:
  * The host publishes this port on 127.0.0.1 only (compose.yml).
  * Browsers must send an allowlisted Origin; others get 403 and no CORS headers.
  * Every endpoint except /hello needs the pairing code as a Bearer token.
  * Learner code runs as uid 1000 inside this container, with time and output limits.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import sys
import threading
import time
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .runner import TABS
from .scenario import NODE_NAMES

VERSION = "1"
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
MAX_BODY = 64 * 1024
MAX_CODE = 20 * 1024
MAX_RUNS = 20
FAIL_LIMIT = 10
FAIL_WINDOW = 60.0
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def get_or_create_token(state_dir: str) -> str:
    path = os.path.join(state_dir, "token")
    try:
        with open(path, encoding="utf-8") as f:
            token = f.read().strip()
            if token:
                return token
    except OSError:
        pass
    os.makedirs(state_dir, exist_ok=True)
    token = "".join(secrets.choice(ALPHABET) for _ in range(12))
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(token)
    os.chmod(path, 0o600)
    return token


def format_token(token: str) -> str:
    return "-".join(token[i : i + 4] for i in range(0, len(token), 4))


def _normalise(token: str) -> str:
    return token.replace("-", "").replace(" ", "").upper()


class Bridge:
    def __init__(self, token, origins, run_fn, check_fn, reset_fn, status_fn, exercises, clock=time.monotonic):
        self.token = _normalise(token)
        self.origins = set(origins)
        self.run_fn, self.check_fn, self.reset_fn, self.status_fn = run_fn, check_fn, reset_fn, status_fn
        self.exercises = set(exercises)
        self.clock = clock
        self.failures: deque[float] = deque()
        self.runs: dict[str, deque] = defaultdict(lambda: deque(maxlen=MAX_RUNS))
        self.lock = threading.Lock()

    # -- helpers -----------------------------------------------------------------------------
    def _cors(self, origin: str | None) -> dict:
        if not origin:
            return {}
        return {
            "Access-Control-Allow-Origin": origin,
            "Vary": "Origin",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST",
            "Access-Control-Max-Age": "600",
        }

    @staticmethod
    def _json(status: int, data, headers: dict) -> tuple:
        return status, {**headers, "Content-Type": "application/json", "Cache-Control": "no-store"}, json.dumps(data).encode()

    def _rate_limited(self) -> bool:
        now = self.clock()
        while self.failures and now - self.failures[0] > FAIL_WINDOW:
            self.failures.popleft()
        return len(self.failures) >= FAIL_LIMIT

    def _authorised(self, headers: dict) -> bool:
        auth = headers.get("authorization", "")
        given = _normalise(auth[7:]) if auth.lower().startswith("bearer ") else ""
        ok = bool(given) and secrets.compare_digest(given, self.token)
        if not ok:
            self.failures.append(self.clock())
        return ok

    # -- entry point -------------------------------------------------------------------------
    def handle(self, method: str, path: str, headers: dict, body: bytes) -> tuple:
        headers = {k.lower(): v for k, v in headers.items()}
        origin = headers.get("origin")
        if origin and origin not in self.origins:
            return self._json(403, {"error": "origin not allowed"}, {})
        cors = self._cors(origin)
        path = path.split("?", 1)[0]

        if method == "OPTIONS":
            extra = {"Access-Control-Allow-Private-Network": "true"} if origin else {}
            return 204, {**cors, **extra}, b""
        if method == "GET" and path == "/hello":
            return self._json(200, {"lab": "jifunze", "version": VERSION}, cors)

        with self.lock:
            if self._rate_limited():
                return self._json(429, {"error": "too many wrong pairing codes; wait a minute"}, cors)
            if not self._authorised(headers):
                return self._json(401, {"error": "pairing code missing or wrong"}, cors)

        if method == "GET" and path == "/status":
            return self._json(200, self.status_fn(), cors)
        if method != "POST" or path not in ("/run", "/check", "/reset"):
            return self._json(404, {"error": "not found"}, cors)

        if len(body) > MAX_BODY:
            return self._json(413, {"error": "request too large"}, cors)
        try:
            data = json.loads(body or b"{}")
            if not isinstance(data, dict):
                raise ValueError("expected an object")
        except ValueError:
            return self._json(400, {"error": "body must be a JSON object"}, cors)

        if path == "/run":
            return self._run(data, cors)
        if path == "/check":
            exercise = data.get("exercise")
            if exercise not in self.exercises:
                return self._json(404, {"error": f"unknown exercise {exercise!r}"}, cors)
            return self._json(200, self.check_fn(exercise, list(self.runs[exercise])), cors)
        lesson = data.get("lesson", "")
        if not isinstance(lesson, str) or not SLUG.match(lesson):
            return self._json(400, {"error": "lesson must be a slug"}, cors)
        return self._json(200, self.reset_fn(lesson), cors)

    def _run(self, data: dict, cors: dict) -> tuple:
        tab, node, code, exercise = data.get("tab"), data.get("node"), data.get("code"), data.get("exercise", "")
        if tab not in TABS:
            return self._json(400, {"error": f"tab must be one of {', '.join(TABS)}"}, cors)
        if node not in (*NODE_NAMES, "erin", "none"):
            return self._json(400, {"error": "unknown node"}, cors)
        if not isinstance(code, str):
            return self._json(400, {"error": "code must be text"}, cors)
        if len(code.encode()) > MAX_CODE:
            return self._json(413, {"error": "code is longer than 20 KB"}, cors)
        result = self.run_fn(tab, code, node)
        if isinstance(exercise, str) and exercise in self.exercises:
            self.runs[exercise].append(
                {"node": node, "tab": tab, "code": code, "exitCode": result["exitCode"], "stdout": result["stdout"]}
            )
        return self._json(200, result, cors)


# -- HTTP adapter ------------------------------------------------------------------------------
def serve(bridge: Bridge, host: str = "0.0.0.0", port: int = 7777) -> None:
    class Handler(BaseHTTPRequestHandler):
        server_version = "jifunze-lab"
        sys_version = ""

        def _go(self) -> None:
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(min(length, MAX_BODY + 1)) if length else b""
            status, headers, out = bridge.handle(self.command, self.path, dict(self.headers.items()), body)
            self.send_response(status)
            for k, v in headers.items():
                self.send_header(k, v)
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)

        do_GET = do_POST = do_OPTIONS = _go

        def log_message(self, fmt, *args) -> None:  # keep logs short and free of codes
            sys.stderr.write(f"bridge: {self.command} {self.path.split('?')[0]} {args[1] if len(args) > 1 else ''}\n")

    ThreadingHTTPServer((host, port), Handler).serve_forever()


def main(argv: list[str]) -> None:
    state = os.environ.get("JIFUNZE_STATE", "/lab/state")
    token = get_or_create_token(state)
    if "--token" in argv:
        print(token if "--raw" in argv else format_token(token))
        return

    from .checks import CHECKS
    from .health import status
    from .runner import run
    from .scenario import ScenarioError, ensure, load

    from .checks import Lab

    def check_fn(exercise: str, runs: list) -> list:
        try:
            return CHECKS[exercise](Lab(), runs)
        except Exception as e:  # noqa: BLE001 - report check crashes as a failed result
            return [{"id": "error", "label": {"sw": f"Ukaguzi umeshindwa: {e}", "en": f"Check failed: {e}"}, "pass": False}]

    def reset_fn(lesson: str) -> dict:
        lines: list[str] = []
        try:
            ensure(load(lesson), log=lines.append)
            return {"ok": True, "log": "\n".join(lines)}
        except (ScenarioError, Exception) as e:  # noqa: BLE001
            return {"ok": False, "log": "\n".join([*lines, str(e)])}

    origins = [o.strip() for o in os.environ.get("JIFUNZE_ORIGINS", "").split(",") if o.strip()]
    bridge = Bridge(token, origins, run, check_fn, reset_fn, status, exercises=CHECKS.keys())
    print(f"Jifunze lab bridge on :7777. Pairing code: {format_token(token)}", file=sys.stderr)
    serve(bridge)


if __name__ == "__main__":
    main(sys.argv[1:])
