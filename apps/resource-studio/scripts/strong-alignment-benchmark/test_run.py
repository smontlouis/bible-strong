import io
from pathlib import Path
import tempfile
import unittest

import eflomal
from run import PriorIndex, parse_links


class PriorTests(unittest.TestCase):
    def test_subset_has_same_native_priors_as_full_file_with_uppercase_strong(self):
        text = "LEX\tH0001\tpere\t20\nLEX\tH0001\tabsent\t7\nLEX\tG0001\tpere\t4\nFERF\tH0001\t1\t5\nFERR\tpere\t1\t6\nHMMF\t1\t5\nHMMR\t1\t3\n"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "priors.txt"
            path.write_text(text)
            index = PriorIndex(path)
            source = eflomal.TextIndex({"h0001": 0})
            target = eflomal.TextIndex({"pere": 0})
            def convert(input):
                output = io.StringIO()
                eflomal.to_eflomal_priors_file(eflomal.read_priors(input), source, target, output)
                return output.getvalue()
            self.assertEqual(convert(io.StringIO(text)), convert(index.for_pair(["H0001"], ["pere"])))

    def test_links_reject_duplicates_and_out_of_range_positions(self):
        self.assertEqual(parse_links("0-1 1-0", 2, 2), [[0, 1], [1, 0]])
        with self.assertRaises(ValueError):
            parse_links("0-1 0-1", 2, 2)
        with self.assertRaises(ValueError):
            parse_links("2-0", 2, 2)


if __name__ == "__main__":
    unittest.main()
