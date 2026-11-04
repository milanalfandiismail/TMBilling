import os
import tempfile
import unittest
from unittest.mock import patch

from app.utils import logger as logmod


class TestLoggerIO(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".log")
        self.tmp.close()
        self.patcher = patch.object(logmod, "LOG_FILE", self.tmp.name)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        os.unlink(self.tmp.name)

    def test_write_log_does_not_print(self):
        with patch("builtins.print") as p:
            logmod.write_log("LOGIN", "tes")
        p.assert_not_called()

    def test_read_logs_returns_latest_first(self):
        for i in range(5):
            with open(self.tmp.name, "a", encoding="utf-8") as f:
                f.write(f'{{"detail": "baris-{i}"}}\n')
        logs = logmod.read_logs(limit=2)
        self.assertEqual(len(logs), 2)
        self.assertIn("baris-4", logs[0])

    def test_read_logs_does_not_read_whole_file(self):
        for i in range(10):
            with open(self.tmp.name, "a", encoding="utf-8") as f:
                f.write(f'{{"detail": "baris-{i}"}}\n')

        real_open = open
        target = os.path.abspath(self.tmp.name)

        class _NoReadlines:
            def __init__(self, handle):
                self._handle = handle

            def __iter__(self):
                return iter(self._handle)

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                self._handle.close()

            def readlines(self):
                raise AssertionError("read_logs tidak boleh memakai readlines()")

        def _fake_open(path, *args, **kwargs):
            handle = real_open(path, *args, **kwargs)
            return _NoReadlines(handle) if os.path.abspath(path) == target else handle

        with patch("builtins.open", _fake_open):
            logs = logmod.read_logs(limit=3)

        self.assertEqual(len(logs), 3)
        self.assertIn("baris-9", logs[0])
