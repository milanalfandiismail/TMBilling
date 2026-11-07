"""Root pytest configuration and early initialization for TMBilling.
Executed before any test collection or plugin initialization.
"""

import os
import sys
import tempfile
import shutil

# 1. Pastikan TEMP dan TMP selalu diarahkan ke drive lokal C: repositori
# Menghindari kegagalan 'No space left on device' pada RAM disk (misal drive X: yang penuh)
_root_dir = os.path.dirname(os.path.abspath(__file__))
_pytest_temp = os.path.join(_root_dir, ".pytest_temp")
os.makedirs(_pytest_temp, exist_ok=True)

os.environ["TEMP"] = _pytest_temp
os.environ["TMP"] = _pytest_temp
tempfile.tempdir = _pytest_temp

# Monkeypatch tempfile factories agar jika dir=None otomatis menggunakan _pytest_temp
_orig_spooled = tempfile.SpooledTemporaryFile
def _patched_spooled(*args, **kwargs):
    if kwargs.get("dir") is None:
        kwargs["dir"] = _pytest_temp
    return _orig_spooled(*args, **kwargs)
tempfile.SpooledTemporaryFile = _patched_spooled

_orig_tempfile = tempfile.TemporaryFile
def _patched_tempfile(*args, **kwargs):
    if kwargs.get("dir") is None:
        kwargs["dir"] = _pytest_temp
    return _orig_tempfile(*args, **kwargs)
tempfile.TemporaryFile = _patched_tempfile

_orig_named_tempfile = tempfile.NamedTemporaryFile
def _patched_named_tempfile(*args, **kwargs):
    if kwargs.get("dir") is None:
        kwargs["dir"] = _pytest_temp
    return _orig_named_tempfile(*args, **kwargs)
tempfile.NamedTemporaryFile = _patched_named_tempfile

# 2. Pastikan testing environment dan database terisolasi dari warnet.db produksi
os.environ["FLASK_ENV"] = "testing"
os.environ["DATABASE_URL"] = "sqlite:///test_warnet.db"
os.environ["TM_DISABLE_SCHEDULER"] = "1"

# 3. Isolasi file audit logger ke dalam folder sementara testing
_temp_log_dir = os.path.join(_pytest_temp, "logs")
_temp_archive_dir = os.path.join(_temp_log_dir, "archives")
os.makedirs(_temp_archive_dir, exist_ok=True)
_temp_log_file = os.path.join(_temp_log_dir, "warnet.log")

import app.utils.logger as logger_mod
logger_mod.LOG_DIR = _temp_log_dir
logger_mod.LOG_ARCHIVE_DIR = _temp_archive_dir
logger_mod.LOG_FILE = _temp_log_file

import pytest
from app.services.cache import reset_all_cache


@pytest.fixture(scope="session", autouse=True)
def guard_test_database():
    """Safety guard: pastikan test suite tidak pernah terhubung ke database asli (warnet.db)."""
    from app.config import Config
    uri = str(Config.SQLALCHEMY_DATABASE_URI).replace("\\", "/")
    if "warnet.db" in uri and "test_warnet.db" not in uri:
        raise RuntimeError(f"CRITICAL SAFETY GUARD: Pytest terdeteksi mencoba menyentuh database produksi '{uri}'!")
    yield


@pytest.fixture(autouse=True)
def reset_in_memory_stores():
    """Reset seluruh state in-memory sebelum dan sesudah setiap test agar terisolasi sempurna."""
    reset_all_cache()
    yield
    reset_all_cache()
