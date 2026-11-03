import json
import os
import tempfile
import unittest

from jifunze_lab import scenario


class LoadScenario(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        os.environ["JIFUNZE_SCENARIOS"] = self.dir

    def write(self, name, data):
        with open(os.path.join(self.dir, f"{name}.json"), "w") as f:
            json.dump(data, f)

    def test_base_is_inherited_and_extended(self):
        self.write("route", {"fund": ["alice", "bob"], "channels": [{"from": "alice", "to": "bob", "sats": 1000000}]})
        self.write("routing-htlcs", {"base": "route", "mine": 3})
        sc = scenario.load("routing-htlcs")
        self.assertEqual(sc["fund"], ["alice", "bob"])
        self.assertEqual(sc["mine"], 3)
        self.assertEqual(len(sc["channels"]), 1)

    def test_unknown_node_is_rejected(self):
        self.write("bad", {"fund": ["zed"]})
        with self.assertRaises(scenario.ScenarioError):
            scenario.load("bad")

    def test_missing_scenario_names_the_file(self):
        with self.assertRaises(scenario.ScenarioError) as ctx:
            scenario.load("nope")
        self.assertIn("nope", str(ctx.exception))

    def test_channel_to_self_is_rejected(self):
        self.write("selfie", {"channels": [{"from": "bob", "to": "bob", "sats": 100000}]})
        with self.assertRaises(scenario.ScenarioError):
            scenario.load("selfie")
