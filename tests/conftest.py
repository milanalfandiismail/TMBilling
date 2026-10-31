"""Global pytest configuration and fixtures for TMBilling."""

import pytest
from app.services.cache import reset_all_cache


@pytest.fixture(autouse=True)
def reset_in_memory_stores():
    """Reset seluruh state in-memory sebelum dan sesudah setiap test agar terisolasi sempurna."""
    reset_all_cache()
    yield
    reset_all_cache()
