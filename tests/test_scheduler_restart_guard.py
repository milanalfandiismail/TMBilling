from app import create_app
from app.routes.settings import general_routes
from app.utils import scheduler_tasks


def test_restart_tidak_keluar_bila_proses_baru_mati(tmp_path, monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })

    class Mati:
        returncode = 3

        def poll(self):
            return 3

    logged = []
    monkeypatch.setattr(general_routes.subprocess, "Popen", lambda *a, **k: Mati())
    monkeypatch.setattr(general_routes.time, "sleep", lambda *a: None)
    monkeypatch.setattr(scheduler_tasks, "run_flush_uptime", lambda *a, **k: None)
    monkeypatch.setattr(
        general_routes.os,
        "_exit",
        lambda code: (_ for _ in ()).throw(AssertionError("os._exit dipanggil")),
    )
    monkeypatch.setattr(general_routes, "write_log", lambda *a, **k: logged.append(a))

    assert general_routes._restart_server(app) is False
    assert logged and logged[0][0] == "SCHEDULER_RESTART_ERROR"
