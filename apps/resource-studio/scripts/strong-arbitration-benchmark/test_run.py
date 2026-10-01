import unittest
from run import validate


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.request = {"questions":{"placement":{"criteria":{"A":"one","B":"two"}}}}

    def raw(self, a=.8, b=.2, choice="A"):
        return {"answers":{"placement":{"type":"choice","choice":choice,"probabilities":{"A":a,"B":b}}},"rounding":{"probabilityDecimals":2}}

    def test_rounding_is_preserved(self):
        self.assertEqual(validate(self.raw(.80,.19),self.request)["probability"],.80)

    def test_invalid_probabilities_and_nonmaximal_choices(self):
        for raw in [self.raw(.3,.7), self.raw(True,0), self.raw(float("nan"),.2), self.raw(.8,.8)]:
            with self.assertRaises(ValueError):
                validate(raw,self.request)

    def test_warning_fails_closed(self):
        raw=self.raw()
        raw["warnings"]=[{"type":"other","message":"truncated"}]
        with self.assertRaisesRegex(ValueError,"provider-warnings"):
            validate(raw,self.request)


if __name__=="__main__":
    unittest.main()
