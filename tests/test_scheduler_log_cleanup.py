from datetime import datetime, timedelta

from app import create_app
from app.utils import logger as logger_module
from app.utils import scheduler_tasks


def _app(tmp_path):
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })


def test_bulan_berarti_tiga_puluh_hari():
    assert scheduler_tasks.UNIT_MULTIPLIER["bulan"] == 30 * 86400


def test_cleanup_log_memakai_retensi_bulan(tmp_path, monkeypatch):
    app = _app(tmp_path)
    log_file = tmp_path / "warnet.log"
    lama = (datetime.now() - timedelta(days=40)).strftime("%Y-%m-%d %H:%M:%S")
    baru = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d %H:%M:%S")
    log_file.write_text(
        '{"timestamp": "' + lama + '", "action": "LAMA"}\n'
        '{"timestamp": "' + baru + '", "action": "BARU"}\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(logger_module, "LOG_FILE", str(log_file))

    with app.app_context():
        from app.services import SettingsService
        SettingsService.set("auto_cleanup_value", "1")
        SettingsService.set("auto_cleanup_unit", "bulan")
        scheduler_tasks.run_cleanup_logs(app)

    isi = log_file.read_text(encoding="utf-8")
    assert "LAMA" not in isi
    assert "BARU" in isi
