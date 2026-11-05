import json
import os
import re
import tempfile
import unittest

from jifunze_lab.bridge import Bridge, format_token, get_or_create_token

ORIGIN = "https://bitsaccojifunze.xyz"
STAGING_ORIGIN = "https://staging.bitsaccojifunze.xyz"
TOKEN = "ABCDEFGHJKLM"


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def make(**kw):
    calls = {"run": [], "check": [], "reset": []}

    def run_fn(tab, code, node):
        calls["run"].append((tab, code, node))
        return {"stdout": "ok\n", "stderr": "", "exitCode": 0, "ms": 5, "timedOut": False, "truncated": False}

    def check_fn(exercise, runs):
        calls["check"].append((exercise, list(runs)))
        return [{"id": "a", "label": {"sw": "Sawa", "en": "Fine"}, "pass": True}]

    def reset_fn(lesson):
        calls["reset"].append(lesson)
        return {"ok": True, "log": "Scenario ready."}

    b = Bridge(
        token=TOKEN,
        origins=[ORIGIN, STAGING_ORIGIN, "http://localhost:3000"],
        run_fn=run_fn,
        check_fn=check_fn,
        reset_fn=reset_fn,
        status_fn=lambda: {"profile": "lite", "nodes": {}},
        exercises={"ch02-dina-invoice", "ch08-multihop"},
        clock=kw.get("clock", Clock()),
    )
    return b, calls


def req(b, method, path, body=None, origin=ORIGIN, token=TOKEN):
    headers = {}
    if origin:
        headers["origin"] = origin
    if token:
        headers["authorization"] = f"Bearer {token}"
    raw = json.dumps(body).encode() if body is not None else b""
    status, out_headers, out = b.handle(method, path, headers, raw)
    return status, out_headers, (json.loads(out) if out else None)


class Origins(unittest.TestCase):
    def test_disallowed_origin_is_refused_without_cors_headers(self):
        b, _ = make()
        status, headers, _ = req(b, "GET", "/status", origin="https://evil.example")
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_preflight_from_allowed_origin_allows_private_network(self):
        b, _ = make()
        for origin in [ORIGIN, STAGING_ORIGIN]:
            with self.subTest(origin=origin):
                status, headers, _ = req(b, "OPTIONS", "/run", origin=origin, token=None)
                self.assertEqual(status, 204)
                self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
                self.assertEqual(headers["Access-Control-Allow-Private-Network"], "true")
                self.assertIn("authorization", headers["Access-Control-Allow-Headers"])
                self.assertEqual(headers["Vary"], "Origin")

    def test_preflight_from_other_origin_is_refused(self):
        b, _ = make()
        status, headers, _ = req(b, "OPTIONS", "/run", origin="https://evil.example", token=None)
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Private-Network", headers)

    def test_hello_needs_no_token(self):
        b, _ = make()
        status, _, body = req(b, "GET", "/hello", token=None)
        self.assertEqual(status, 200)
        self.assertEqual(body["lab"], "jifunze")


class Tokens(unittest.TestCase):
    def test_missing_token_is_401(self):
        b, _ = make()
        self.assertEqual(req(b, "GET", "/status", token=None)[0], 401)

    def test_token_is_accepted_with_dashes_and_lowercase(self):
        b, _ = make()
        self.assertEqual(req(b, "GET", "/status", token="abcd-efgh-jklm")[0], 200)

    def test_repeated_bad_tokens_are_rate_limited(self):
        clock = Clock()
        b, _ = make(clock=clock)
        for _ in range(10):
            self.assertEqual(req(b, "GET", "/status", token="WRONGWRONGWR")[0], 401)
        self.assertEqual(req(b, "GET", "/status", token="WRONGWRONGWR")[0], 429)
        self.assertEqual(req(b, "GET", "/status")[0], 429)  # even the right token waits
        clock.t += 61
        self.assertEqual(req(b, "GET", "/status")[0], 200)


class Run(unittest.TestCase):
    def test_run_passes_through_and_is_logged_for_checks(self):
        b, calls = make()
        status, _, body = req(b, "POST", "/run", {"exercise": "ch02-dina-invoice", "node": "dina", "tab": "cli", "code": "lncli getinfo"})
        self.assertEqual(status, 200)
        self.assertEqual(body["stdout"], "ok\n")
        self.assertEqual(calls["run"], [("cli", "lncli getinfo", "dina")])
        req(b, "POST", "/check", {"exercise": "ch02-dina-invoice"})
        runs = calls["check"][0][1]
        self.assertEqual(runs[0]["node"], "dina")
        self.assertEqual(runs[0]["code"], "lncli getinfo")
        self.assertEqual(runs[0]["exitCode"], 0)

    def test_unknown_tab_is_400(self):
        b, _ = make()
        status, _, body = req(b, "POST", "/run", {"exercise": "ch02-dina-invoice", "node": "dina", "tab": "rust", "code": "x"})
        self.assertEqual(status, 400)
        self.assertIn("tab", body["error"])

    def test_unknown_node_is_400(self):
        b, _ = make()
        self.assertEqual(req(b, "POST", "/run", {"exercise": "ch02-dina-invoice", "node": "zed", "tab": "cli", "code": "x"})[0], 400)

    def test_oversized_code_is_413(self):
        b, _ = make()
        big = "x" * (20 * 1024 + 1)
        self.assertEqual(req(b, "POST", "/run", {"exercise": "ch02-dina-invoice", "node": "dina", "tab": "cli", "code": big})[0], 413)

    def test_bad_json_is_400(self):
        b, _ = make()
        status, _, _ = b.handle("POST", "/run", {"origin": ORIGIN, "authorization": f"Bearer {TOKEN}"}, b"{nope")
        self.assertEqual(status, 400)

    def test_run_log_keeps_the_last_20(self):
        b, calls = make()
        for i in range(25):
            req(b, "POST", "/run", {"exercise": "ch08-multihop", "node": "alice", "tab": "cli", "code": f"echo {i}"})
        req(b, "POST", "/check", {"exercise": "ch08-multihop"})
        runs = calls["check"][0][1]
        self.assertEqual(len(runs), 20)
        self.assertEqual(runs[-1]["code"], "echo 24")


class CheckAndReset(unittest.TestCase):
    def test_unknown_exercise_is_404(self):
        b, _ = make()
        self.assertEqual(req(b, "POST", "/check", {"exercise": "nope"})[0], 404)

    def test_reset_runs_the_lesson_scenario(self):
        b, calls = make()
        status, _, body = req(b, "POST", "/reset", {"lesson": "routing-htlcs"})
        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(calls["reset"], ["routing-htlcs"])

    def test_reset_rejects_path_tricks(self):
        b, _ = make()
        self.assertEqual(req(b, "POST", "/reset", {"lesson": "../etc/passwd"})[0], 400)

    def test_unknown_path_is_404(self):
        b, _ = make()
        self.assertEqual(req(b, "GET", "/nope")[0], 404)


class Pairing(unittest.TestCase):
    def test_token_is_created_once_and_formatted(self):
        d = tempfile.mkdtemp()
        t1 = get_or_create_token(d)
        t2 = get_or_create_token(d)
        self.assertEqual(t1, t2)
        self.assertRegex(t1, r"^[A-Z2-9]{12}$")
        self.assertTrue(re.fullmatch(r"[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}", format_token(t1)))
        self.assertEqual(oct(os.stat(os.path.join(d, "token")).st_mode & 0o777), "0o600")


if __name__ == "__main__":
    unittest.main()
