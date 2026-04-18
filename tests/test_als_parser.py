"""Unit tests for als_parser.py"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'parser'))

from als_parser import _parse_bool, _to_float


class TestParseBool(unittest.TestCase):
    def test_true_values(self):
        for v in ("true", "1", "yes", "on"):
            self.assertTrue(_parse_bool(v), v)

    def test_false_values(self):
        for v in ("false", "0", "no", "off"):
            self.assertFalse(_parse_bool(v), v)


class TestToFloat(unittest.TestCase):
    def test_valid(self):
        self.assertAlmostEqual(_to_float("3.14"), 3.14)

    def test_invalid_returns_default(self):
        self.assertAlmostEqual(_to_float("bad"), 0.0)


if __name__ == "__main__":
    unittest.main()
