"""Jalankan seluruh uji E2E klien terhadap server throwaway.

    py tools/e2e/run_all.py            # semua uji (~2,5 menit)
    py tools/e2e/run_all.py -v         # verbose

Server dan klien dibuat/dimatikan per test; instance produksi tidak disentuh.
"""

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = Path("X:/Temp/opencode/e2e-out")


def main():
    sys.path.insert(0, str(ROOT))
    OUT.mkdir(parents=True, exist_ok=True)
    suite = unittest.defaultTestLoader.discover(str(HERE), pattern="test_*.py", top_level_dir=str(ROOT))
    result = unittest.TextTestRunner(verbosity=2 if "-v" in sys.argv else 1).run(suite)
    print(f"\nscreenshot: {OUT}")
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
