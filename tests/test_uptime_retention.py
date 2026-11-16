from datetime import datetime, timedelta

import pytest

from app import create_app
from app.models import db, Grup, PC, PCUptimeLog
from app.services.cache.uptime_store import UptimeMemoryStore


@pytest.fixture
def app(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'uptime.db'}",
    })
    with app.app_context():
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="TM-01", nama="PC 1", ip_address="10.0.0.1", mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()
    return app


def _tambah(pc_id, tanggal, last_seen, detik=600):
    db.session.add(PCUptimeLog(pc_id=pc_id, tanggal=tanggal, last_seen=last_seen, total_online_seconds=detik))
    db.session.commit()


def test_prune_sisakan_jangkar_terbaru(app):
    with app.app_context():
        cutoff = UptimeMemoryStore.retention_cutoff()
        pc_id = PC.query.first().id
        _tambah(pc_id, cutoff - timedelta(days=10), datetime(2025, 1, 1, 10, 0))
        _tambah(pc_id, cutoff - timedelta(days=20), datetime(2025, 1, 2, 10, 0))
        _tambah(pc_id, cutoff - timedelta(days=5), None)
        _tambah(pc_id, cutoff, datetime(2025, 3, 1, 10, 0))

        jumlah = UptimeMemoryStore.prune_old_logs(app=app)

        sisa = [(l.tanggal, l.last_seen) for l in PCUptimeLog.query.order_by(PCUptimeLog.id).all()]
        assert jumlah == 2
        assert len(sisa) == 2
        assert sisa[0][1] == datetime(2025, 1, 2, 10, 0)
        assert sisa[1][0] == cutoff


def test_laporan_harian_menyembunyikan_jangkar(app):
    with app.app_context():
        from app.services.hardware.uptime_service import UptimeService
        cutoff = UptimeMemoryStore.retention_cutoff()
        pc_id = PC.query.first().id
        _tambah(pc_id, cutoff - timedelta(days=30), datetime(2025, 1, 2, 10, 0))
        UptimeMemoryStore.prune_old_logs(app=app)

        assert UptimeService.get_daily_report(cutoff - timedelta(days=30)) == []


def test_range_lama_kosong(app):
    with app.app_context():
        from app.services.hardware.uptime_service import UptimeService
        cutoff = UptimeMemoryStore.retention_cutoff()
        hasil = UptimeService.get_range_report(cutoff - timedelta(days=40), cutoff - timedelta(days=30))
        assert hasil == {"summary": {}, "pcs": []}


def test_scheduler_task_mencatat(app, monkeypatch):
    with app.app_context():
        from app.utils import scheduler_tasks
        tercatat = []
        monkeypatch.setattr(scheduler_tasks, "record_run", lambda job_id, ok=True, skipped=False: tercatat.append((job_id, ok)))
        cutoff = UptimeMemoryStore.retention_cutoff()
        pc_id = PC.query.first().id
        _tambah(pc_id, cutoff - timedelta(days=50), datetime(2025, 1, 2, 10, 0))
        _tambah(pc_id, cutoff - timedelta(days=60), datetime(2024, 1, 2, 10, 0))

        scheduler_tasks.run_cleanup_uptime_logs(app)

        assert tercatat == [("cleanup_uptime_logs", True)]
        assert UptimeMemoryStore.prune_old_logs(app=app) == 0
