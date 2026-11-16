from app import create_app
from app.models import db, User
from app.utils import scheduler_tasks


def test_restart_menerapkan_interval_tanpa_respawn(tmp_path, monkeypatch):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with app.app_context():
        db.create_all()
        admin = User(username="sched_admin", nama_lengkap="Admin", role="admin", aktif=True)
        admin.set_password("rahasia123")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id

    scheduler = object()
    app.extensions["scheduler"] = scheduler
    dipanggil = []
    monkeypatch.setattr(
        scheduler_tasks,
        "apply_scheduler_intervals",
        lambda sched: dipanggil.append(sched) or True,
    )

    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin_id
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "admin"

    res = client.post("/api/v1/kasir/settings/scheduler/restart")

    assert res.status_code == 200
    assert res.get_json()["success"] is True
    assert dipanggil == [scheduler]

