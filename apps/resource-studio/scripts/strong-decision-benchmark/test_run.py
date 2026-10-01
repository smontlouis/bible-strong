import unittest

from run import validate


class ProbabilityContractTests(unittest.TestCase):
    def setUp(self):
        self.request = {"questions": {"placement": {"criteria": {"A": "one", "B": "two", "C": "three"}}}}

    def test_declared_rounding_does_not_renormalize(self):
        raw = {"answers": {"placement": {"type": "choice", "choice": "A", "probabilities": {"A": .65, "B": .30, "C": .04}}},
               "rounding": {"probabilityDecimals": 2}}
        result = validate(raw, self.request)
        self.assertEqual(result["probability"], .65)
        self.assertAlmostEqual(sum(result["probabilities"].values()), .99)

    def test_inconsistent_gateway_choice_is_rejected(self):
        raw = {"answers": {"placement": {"type": "choice", "choice": "A", "probabilities": {"A": .30, "B": .31, "C": .39}}},
               "rounding": {"probabilityDecimals": 2}}
        with self.assertRaisesRegex(ValueError, "choice-not-maximal"):
            validate(raw, self.request)

    def test_missing_probability_is_rejected(self):
        raw = {"answers": {"placement": {"type": "choice", "choice": "A", "probabilities": {"A": .8, "B": .2}}}}
        with self.assertRaisesRegex(ValueError, "invalid-choice-contract"):
            validate(raw, self.request)


if __name__ == "__main__":
    unittest.main()
