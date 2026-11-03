import os
import unittest

from jifunze_lab.cli import CliTargetError, lncli_args, parse_cli_args, parse_value


class ParseCliArgs(unittest.TestCase):
    def test_positional_params(self):
        self.assertEqual(parse_cli_args(["invoice", "1000", "lbl", "desc"]), ("invoice", [1000, "lbl", "desc"]))

    def test_keyword_params_with_k(self):
        self.assertEqual(
            parse_cli_args(["-k", "invoice", "amount_msat=1000", "label=x"]),
            ("invoice", {"amount_msat": 1000, "label": "x"}),
        )

    def test_flags_before_method_are_ignored(self):
        self.assertEqual(parse_cli_args(["--network=regtest", "getinfo"]), ("getinfo", []))

    def test_values_parse_json_when_possible(self):
        self.assertEqual(parse_value("true"), True)
        self.assertEqual(parse_value('["a"]'), ["a"])
        self.assertEqual(parse_value("lnbcrt1"), "lnbcrt1")

    def test_missing_method(self):
        with self.assertRaises(SystemExit):
            parse_cli_args([])


class LncliTarget(unittest.TestCase):
    def test_lnd_node_gets_connection_flags(self):
        args = lncli_args("alice")
        self.assertIn("--rpcserver=alice:10009", args)
        self.assertIn("--network=regtest", args)
        self.assertTrue(any(a.startswith("--macaroonpath=") for a in args))

    def test_cln_node_is_refused_with_a_helpful_message(self):
        with self.assertRaises(CliTargetError) as ctx:
            lncli_args("bob")
        self.assertEqual(ctx.exception.code, 2)
        self.assertIn("lightning-cli", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
