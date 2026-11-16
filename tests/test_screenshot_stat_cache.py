import unittest
from unittest.mock import patch

from app.routes.monitor import screenshot_routes


class TestScreenshotStatCache(unittest.TestCase):
    def setUp(self):
        screenshot_routes._STAT_CACHE.clear()

    def test_exists_and_getmtime_called_once_per_ttl(self):
        with patch("app.routes.monitor.screenshot_routes.os.path.exists", return_value=True) as ex, \
             patch("app.routes.monitor.screenshot_routes.os.path.getmtime", return_value=1000.0) as gm:
            self.assertEqual(screenshot_routes._screenshot_mtime("C:/x/TM-1.png"), 1000.0)
            self.assertEqual(screenshot_routes._screenshot_mtime("C:/x/TM-1.png"), 1000.0)
        self.assertEqual(ex.call_count, 1)
        self.assertEqual(gm.call_count, 1)

    def test_missing_file_returns_none(self):
        with patch("app.routes.monitor.screenshot_routes.os.path.exists", return_value=False):
            self.assertIsNone(screenshot_routes._screenshot_mtime("C:/x/none.png"))


if __name__ == "__main__":
    unittest.main()
