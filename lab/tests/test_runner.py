import os
import gc
import time
import unittest
import warnings

os.environ.setdefault("JIFUNZE_SAME_USER", "1")
from jifunze_lab.runner import run  # noqa: E402


class Runner(unittest.TestCase):
    def test_output_streams_are_closed_after_run(self):
        gc.collect()
        with warnings.catch_warnings(record=True) as captured:
            warnings.simplefilter("always", ResourceWarning)
            result = run("python", "print('resource cleanup')", "none")
            gc.collect()
        self.assertEqual(result["stdout"], "resource cleanup\n")
        self.assertEqual(result["exitCode"], 0)
        self.assertEqual([str(w.message) for w in captured if issubclass(w.category, ResourceWarning)], [])

    def test_python_prints(self):
        r = run("python", "print(1)", "none")
        self.assertEqual(r["stdout"], "1\n")
        self.assertEqual(r["exitCode"], 0)
        self.assertFalse(r["timedOut"])

    def test_cli_sees_the_chosen_node(self):
        r = run("cli", 'echo "$JIFUNZE_NODE"', "dina")
        self.assertEqual(r["stdout"].strip(), "dina")

    def test_nonzero_exit_and_stderr(self):
        r = run("cli", "echo oops >&2; exit 3", "none")
        self.assertEqual(r["exitCode"], 3)
        self.assertIn("oops", r["stderr"])

    def test_hanging_code_is_killed(self):
        start = time.monotonic()
        r = run("cli", "sleep 40", "none", timeout=1)
        self.assertTrue(r["timedOut"])
        self.assertLess(time.monotonic() - start, 3)

    def test_children_are_killed_too(self):
        r = run("cli", "(sleep 40; echo late) & sleep 40", "none", timeout=1)
        self.assertTrue(r["timedOut"])
        self.assertNotIn("late", r["stdout"])

    def test_output_is_capped(self):
        r = run("cli", "yes | head -c 200000", "none")
        self.assertTrue(r["truncated"])
        self.assertLessEqual(len(r["stdout"]), 65536 + 40)
        self.assertIn("[output truncated]", r["stdout"])

    def test_endless_output_is_capped_and_killed(self):
        r = run("cli", "yes", "none", timeout=1)
        self.assertTrue(r["truncated"])
        self.assertTrue(r["timedOut"])

    def test_python_can_import_the_helpers(self):
        r = run("python", "import jifunze_lab; print(sorted(jifunze_lab.nodes()))", "none")
        self.assertIn("alice", r["stdout"])

    def test_unknown_tab_is_rejected(self):
        with self.assertRaises(ValueError):
            run("rust", "fn main(){}", "none")
