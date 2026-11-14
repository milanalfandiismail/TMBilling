from pathlib import Path
from datetime import datetime
from unittest.mock import patch

from app.utils import timezone_utils as tz


def test_format_local_now_memakai_zona_setting():
    with patch.object(tz, "now_utc", return_value=datetime(2026, 1, 1, 17, 30)):
        assert tz.format_local_now(tz_name="Asia/Makassar") == "2026-01-02 01:30:00"


def test_format_local_now_format_khusus():
    with patch.object(tz, "now_utc", return_value=datetime(2026, 1, 1, 17, 30)):
        assert tz.format_local_now("%Y%m%d_%H%M%S", tz_name="Asia/Makassar") == "20260102_013000"


def test_tabel_meta_pdf_memakai_zona_setting():
    from app.utils.pdf_helper import PdfHelper

    with patch("app.utils.timezone_utils.now_utc", return_value=datetime(2026, 1, 1, 17, 30)):
        styles = PdfHelper.get_common_styles()
        table, _ = PdfHelper.get_meta_table("2026-01-02", None, styles)
        teks = " ".join(
            cell.text
            for row in table._cellvalues
            for cell in row
            if hasattr(cell, "text")
        )
    assert "2026-01-02 01:30:00" in teks


def test_write_log_memakai_zona_setting(tmp_path, monkeypatch):
    from app.utils import logger as logmod

    target = tmp_path / "warnet.log"
    target.write_text("", encoding="utf-8")
    monkeypatch.setattr(logmod, "LOG_FILE", str(target))
    with patch("app.utils.timezone_utils.now_utc", return_value=datetime(2026, 1, 1, 17, 30)):
        logmod.write_log("LOGIN", "tes", user="admin")
    assert "2026-01-02 01:30:00" in target.read_text(encoding="utf-8")


def test_record_run_memakai_zona_setting(tmp_path):
    from app import create_app
    from app.utils import scheduler_tasks

    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with app.app_context():
        scheduler_tasks._LAST_RUN.clear()
        try:
            with patch("app.utils.timezone_utils.now_utc", return_value=datetime(2026, 1, 1, 17, 30)):
                scheduler_tasks.record_run("flush_uptime")
            assert scheduler_tasks.get_last_runs()["flush_uptime"]["at"] == "2026-01-02T01:30:00"
        finally:
            scheduler_tasks._LAST_RUN.clear()


def test_reset_kuota_memakai_bulan_zona_setting(tmp_path):
    from app import create_app
    from app.models.user.user import User

    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with app.app_context():
        user = User(username="kasir_bulan", role="kasir", kuota_main_bulanan=100,
                    sisa_kuota_menit=5, terakhir_reset_kuota="2026-01")
        with patch("app.models.user.user.now_utc", return_value=datetime(2026, 1, 31, 17, 30)):
            assert user.cek_dan_reset_kuota_bulanan() is True
        assert user.terakhir_reset_kuota == "2026-02"
        assert user.sisa_kuota_menit == 100


def test_add_whitelist_menyimpan_utc(tmp_path):
    from datetime import timezone as dt_timezone
    from app import create_app
    from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService

    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with app.app_context():
        IpWhitelistService.add("10.99.0.7", "uji")
        entry = next(e for e in IpWhitelistService._load_entries() if e["ip"] == "10.99.0.7")
    selisih = abs((datetime.now(dt_timezone.utc) - datetime.fromisoformat(entry["added_at"])).total_seconds())
    assert selisih < 60


BERKAS_JAM_OS = [
    "app/utils/pdf_helper.py",
    "app/services/report/pdf_export_service.py",
    "app/utils/logger.py",
    "app/utils/scheduler_tasks.py",
    "app/models/user/user.py",
    "app/services/ip_whitelist/ip_whitelist_service.py",
    "app/services/backup/backup_service.py",
    "app/services/report/log_audit_service.py",
    "app/routes/settings/database_routes.py",
]


def test_tidak_ada_jam_os_tersisa():
    root = Path(__file__).resolve().parents[1]
    for rel in BERKAS_JAM_OS:
        isi = (root / rel).read_text(encoding="utf-8")
        assert "datetime.now()" not in isi, rel
        assert "datetime.datetime.now()" not in isi, rel
