import glob
import json
import os
import unittest

from jifunze_lab.checks import CHECKS

HERE = os.path.dirname(__file__)
EXERCISES = os.environ.get("JIFUNZE_EXERCISES", os.path.join(HERE, "..", "..", "content", "lightning", "exercises"))
SCENARIOS = os.path.join(HERE, "..", "scenarios")

EXPECTED = {
    "ch02-dina-invoice", "ch02-alice-pays", "ch03-open-channel", "ch03-mine", "ch03-pay-bob",
    "ch04-three-nodes", "ch05-fees", "ch05-backup", "ch07-funding-tx", "ch08-multihop",
    "ch08-preimage", "ch09-coop-close", "ch09-force-close", "ch10-toy-onion", "ch11-graph",
    "ch12-pathfind", "ch13-parse-init", "ch14-peers", "ch15-decode", "ch16-probe",
}


def exercise_files():
    out = {}
    for path in glob.glob(os.path.join(EXERCISES, "*.json")):
        with open(path, encoding="utf-8") as f:
            ex = json.load(f)
        out[ex["id"]] = ex
    return out


class StaticChecks(unittest.TestCase):
    def test_every_planned_exercise_has_a_check(self):
        self.assertEqual(set(CHECKS), EXPECTED)

    def test_every_exercise_file_has_a_check_and_a_solution(self):
        files = exercise_files()
        self.assertEqual(set(files), EXPECTED)
        for ex_id, ex in files.items():
            self.assertIn(ex["tab"], ex["starter"], ex_id)
            self.assertIn(ex["tab"], ex["solution"], ex_id)

    def test_every_lesson_with_exercises_has_a_scenario(self):
        for ex in exercise_files().values():
            self.assertTrue(os.path.exists(os.path.join(SCENARIOS, f"{ex['lesson']}.json")), ex["lesson"])


if __name__ == "__main__":
    unittest.main()
