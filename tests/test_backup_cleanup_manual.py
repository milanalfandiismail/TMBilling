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


def test_cleanup_membatasi_backup_manual(tmp_path):
    for i in range(12):
        berkas = tmp_path / f"warnet_backup_manual_202601{i:02d}_000000.zip"
        berkas.write_bytes(b"x")
        os.utime(berkas, (1_700_000_000 + i, 1_700_000_000 + i))
    BackupService(db_path=str(tmp_path / "warnet.db"),
                  backup_dir=str(tmp_path)).cleanup_old_backups()
    sisa = sorted(p.name for p in tmp_path.glob("warnet_backup_manual_*.zip"))
    assert len(sisa) == 10
    assert "warnet_backup_manual_20260111_000000.zip" in sisa
    assert "warnet_backup_manual_20260100_000000.zip" not in sisa
