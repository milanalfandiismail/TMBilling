import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "install_scripts"))

from extract_update import MAX_EXTRACT_BYTES, check_archive_size


def test_total_dihitung_dari_ukuran_ekstrak():
    info = [SimpleNamespace(file_size=10), SimpleNamespace(file_size=32)]
    assert check_archive_size(info) == 42


def test_melebihi_batas_ditolak():
    info = [SimpleNamespace(file_size=MAX_EXTRACT_BYTES + 1)]
    with pytest.raises(ValueError, match="terlalu besar"):
        check_archive_size(info)


def test_batas_kustom():
    info = [SimpleNamespace(file_size=11)]
    with pytest.raises(ValueError):
        check_archive_size(info, limit=10)

