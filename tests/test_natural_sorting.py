import unittest
import re

def natural_sort_key(s):
    # Ini adalah fungsi helper yang akan diimplementasikan di backend
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s or '')]

class TestNaturalSorting(unittest.TestCase):
    def test_natural_sort_key(self):
        # Pola penamaan komputer warnet/billing yang acak/lexicographical
        pc_list = ["TM-1", "TM-10", "TM-2", "TM-20", "TM-3", "PC-01", "PC-10", "PC-2", "VIP-2", "VIP-10", "VIP-1"]
        
        # Sort menggunakan natural sort key
        pc_list.sort(key=natural_sort_key)
        
        expected_sort = [
            "PC-01", "PC-2", "PC-10",
            "TM-1", "TM-2", "TM-3", "TM-10", "TM-20",
            "VIP-1", "VIP-2", "VIP-10"
        ]
        self.assertEqual(pc_list, expected_sort)

if __name__ == "__main__":
    unittest.main()
