from app import create_app
from app.utils import scheduler_tasks


def test_status_job_bertahan_setelah_memori_dibersihkan(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with app.app_context():
        scheduler_tasks._LAST_RUN.clear()
        scheduler_tasks.record_run("flush_uptime", False)
        scheduler_tasks._LAST_RUN.clear()
        runs = scheduler_tasks.get_last_runs()
        assert runs["flush_uptime"]["ok"] is False
        assert runs["flush_uptime"]["at"]


def test_record_run_gagal_simpan_dicatat(tmp_path, monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with app.app_context():
        from app.services import SettingsService

        def gagal_set(*args, **kwargs):
            raise RuntimeError("settings terkunci")

        monkeypatch.setattr(SettingsService, "set", staticmethod(gagal_set))
        tercatat = []
        monkeypatch.setattr(scheduler_tasks, "write_log",
                            lambda kode, pesan, **kw: tercatat.append(kode))
        scheduler_tasks._LAST_RUN.clear()
        scheduler_tasks.record_run("flush_uptime", True)
        assert scheduler_tasks._LAST_RUN["flush_uptime"]["ok"] is True
        assert tercatat == ["SCHEDULER_STATUS_ERROR"]
