import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "rust"))

from client_harness import ClientHarness  # noqa: E402


@pytest.fixture(scope="session")
def h():
    h = ClientHarness.start()
    yield h
    h.close()
