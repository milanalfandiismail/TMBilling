"""Unit tests untuk app.services.owner.analytics_service."""

from datetime import datetime, timedelta, timezone
import pytest
from app import create_app, db
from app.models import Member, Grup
from app.services.owner.analytics_service import OwnerAnalyticsService


@pytest.fixture
def app_analytics():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        yield app, grup.id
        db.session.remove()
        db.drop_all()


def test_member_trend_strict_date_bounds(app_analytics):
    app, grup_id = app_analytics
    now_utc = datetime.now(timezone.utc)
    start = now_utc - timedelta(days=7)
    end = now_utc

    with app.app_context():
        # Member 1: Dalam rentang [start, end]
        m1 = Member(username="m_in", grup_id=grup_id, password_hash="dummy", dibuat_pada=now_utc - timedelta(days=3))
        # Member 2: Di luar rentang (sebelum start)
        m2 = Member(username="m_before", grup_id=grup_id, password_hash="dummy", dibuat_pada=now_utc - timedelta(days=15), kadaluarsa_pada=now_utc - timedelta(days=10))
        # Member 3: Di luar rentang (setelah end)
        m3 = Member(username="m_after", grup_id=grup_id, password_hash="dummy", dibuat_pada=now_utc + timedelta(days=2))

        db.session.add_all([m1, m2, m3])
        db.session.commit()

        trend = OwnerAnalyticsService.get_member_trend(start, end)
        assert sum(trend["baru"]) == 1
        assert sum(trend["kadaluarsa"]) == 0
