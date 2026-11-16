import pytest

from app import create_app
from app.services import SesiService
from app.utils import scheduler_tasks


def test_kegagalan_cleanup_sesi_ditulis_ke_log(tmp_path, monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    logged = []
    monkeypatch.setattr(scheduler_tasks, "write_log", lambda *a, **k: logged.append(a))

    def boom():
        raise RuntimeError("sesi rusak")

    monkeypatch.setattr(SesiService, "cleanup_expired", staticmethod(boom))
    with app.app_context():
        with pytest.raises(RuntimeError):
            scheduler_tasks.run_cleanup_expired(app)
    assert logged
    assert logged[0][0] == "SCHEDULER_ERROR"
