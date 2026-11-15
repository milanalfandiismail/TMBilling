from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _baca(relatif):
    return (ROOT / relatif).read_text(encoding="utf-8")


def test_ui_memantau_status_backup():
    js = _baca("app/static/js/kasir/modules/settings/settings_general.js")
    assert "/api/v1/kasir/backup/manual/status" in js
    assert "pollBackupStatus" in js
    assert "setTimeout(r, 2000)" in js
    assert "res.status === 'succeeded'" in js
    assert "res.status === 'partial'" in js
    assert "res.status === 'failed'" in js


def test_loop_backup_lama_sudah_dihapus():
    service = _baca("app/services/backup/backup_service.py")
    assert "def _run(" not in service
    assert "self.interval" not in service
