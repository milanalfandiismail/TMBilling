from datetime import date

import pytest

from app import create_app
from app.models import db
from app.services.report.report_service import ReportService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'report.db'}",
    })
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_laporan_harian_memakai_tanggal_lokal(app_ctx, monkeypatch):
    monkeypatch.setattr(
        "app.services.report.report_service.get_today_local_date",
        lambda: date(2099, 1, 2),
        raising=False,
    )
    result = ReportService.get_laporan_harian()
    assert result["tanggal"] == "2099-01-02"
