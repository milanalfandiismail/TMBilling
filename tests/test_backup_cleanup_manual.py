"""Rotasi backup otomatis tidak boleh menghapus backup manual."""
import os
from types import SimpleNamespace

from app.services.backup.backup_service import BackupService


def test_cleanup_mempertahankan_backup_manual(tmp_path):
    for i in range(6):
        (tmp_path / f"warnet_backup_2026010{i}_000000.zip").write_bytes(b"x")
    manual = tmp_path / "warnet_backup_manual_20260101_000000.zip"
    manual.write_bytes(b"x")
    BackupService(db_path=str(tmp_path / "warnet.db"),
                  backup_dir=str(tmp_path)).cleanup_old_backups(max_keep=1)
    sisa = sorted(os.listdir(tmp_path))
    assert "warnet_backup_manual_20260101_000000.zip" in sisa
    assert len(sisa) == 2
