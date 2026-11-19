import unittest
from app.utils.helpers import natural_sort_key


class TestNaturalSort(unittest.TestCase):
    def test_order(self):
        values = ["TM-10", "TM-2", "TM-1"]
        self.assertEqual(sorted(values, key=natural_sort_key),
                         ["TM-1", "TM-2", "TM-10"])

    def test_none_is_empty_key(self):
        self.assertEqual(natural_sort_key(None), [])


if __name__ == "__main__":
    unittest.main()
