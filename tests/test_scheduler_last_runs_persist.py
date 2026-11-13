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
