import pytest
from apscheduler.schedulers.background import BackgroundScheduler

from app import create_app
from app.models import db, User
from app.services import SettingsService
from app.utils import scheduler_tasks


@pytest.fixture
def app(tmp_path):
    application = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with application.app_context():
        db.create_all()
        admin = User(username="sched_admin", nama_lengkap="Admin", role="admin", aktif=True)
        admin.set_password("rahasia123")
        db.session.add(admin)
        db.session.commit()
    return application


def _interval(scheduler, job_id):
    return scheduler.get_job(job_id).trigger.interval.total_seconds()


def test_apply_scheduler_intervals_reschedules(app):
    with app.app_context():
        SettingsService.set("auto_backup_value", "10")
        SettingsService.set("auto_backup_unit", "menit")
        SettingsService.set("screenshot_auto_value", "30")
        SettingsService.set("screenshot_auto_unit", "detik")

        scheduler = BackgroundScheduler()
        scheduler.add_job(lambda: None, "interval", seconds=999, id="database_backup")
        scheduler.add_job(lambda: None, "interval", seconds=999, id="auto_screenshots")
        scheduler.start()
        try:
            assert scheduler_tasks.apply_scheduler_intervals(scheduler) is True
            assert _interval(scheduler, "database_backup") == 600
            assert _interval(scheduler, "auto_screenshots") == 30
        finally:
            scheduler.shutdown(wait=False)


def test_apply_scheduler_intervals_tanpa_scheduler():
    assert scheduler_tasks.apply_scheduler_intervals(None) is False


def test_run_auto_screenshots_menandai_dilewati(app, monkeypatch):
    from app.services.health.health_service import HealthService

    monkeypatch.setattr(HealthService, "has_free_space", staticmethod(lambda *a, **k: False))
    scheduler_tasks.run_auto_screenshots(app)

    runs = scheduler_tasks.get_last_runs()
    assert runs["auto_screenshots"]["skipped"] is True


def test_put_scheduler_menerapkan_interval(app, monkeypatch):
    app.extensions["scheduler"] = object()
    dipanggil = []
    monkeypatch.setattr(
        scheduler_tasks,
        "apply_scheduler_intervals",
        lambda sched: dipanggil.append(sched) or True,
    )

    with app.app_context():
        admin_id = User.query.filter_by(username="sched_admin").first().id

    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin_id
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "admin"

    res = client.put(
        "/api/v1/kasir/settings/scheduler",
        json={
            "backup_value": 15,
            "backup_unit": "menit",
            "cleanup_value": 7,
            "cleanup_unit": "hari",
            "screenshot_enabled": "1",
            "screenshot_value": 45,
            "screenshot_unit": "detik",
        },
    )

    assert res.status_code == 200
    assert dipanggil == [app.extensions["scheduler"]]

