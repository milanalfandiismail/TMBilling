"""Scheduler uptime harus memegang WRITE_LOCK dan mencatat kegagalan flush."""
import ast
from pathlib import Path

import pytest

from app import create_app, db
from app.services.hardware.uptime_service import UptimeService
from app.utils import scheduler_tasks

ROOT = Path(__file__).resolve().parents[1]


def _decorators(nama):
    tree = ast.parse((ROOT / "app/utils/scheduler_tasks.py").read_text(encoding="utf-8-sig"))
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == nama:
            return [ast.unparse(d) for d in node.decorator_list]
    raise AssertionError(f"fungsi {nama} tidak ditemukan")


@pytest.fixture()
def aplikasi():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()


def test_wrapper_uptime_memegang_write_lock():
    assert any("with_write_lock" in d for d in _decorators("run_flush_uptime"))
    assert any("with_write_lock" in d for d in _decorators("run_cleanup_uptime_logs"))


def test_flush_gagal_dicatat_gagal(aplikasi, monkeypatch):
    catatan = []
    monkeypatch.setattr(scheduler_tasks, "record_run",
                        lambda job_id, ok=True, skipped=False: catatan.append((job_id, ok)))
    monkeypatch.setattr(scheduler_tasks, "write_log", lambda *a, **k: None)
    monkeypatch.setattr(UptimeService, "flush_uptime_to_db", staticmethod(lambda app=None: False))
    scheduler_tasks.run_flush_uptime(aplikasi)
    assert catatan == [("flush_uptime", False)]


def test_flush_sukses_dicatat_sukses(aplikasi, monkeypatch):
    catatan = []
    monkeypatch.setattr(scheduler_tasks, "record_run",
                        lambda job_id, ok=True, skipped=False: catatan.append((job_id, ok)))
    monkeypatch.setattr(scheduler_tasks, "write_log", lambda *a, **k: None)
    monkeypatch.setattr(UptimeService, "flush_uptime_to_db", staticmethod(lambda app=None: True))
    scheduler_tasks.run_flush_uptime(aplikasi)
    assert catatan == [("flush_uptime", True)]
