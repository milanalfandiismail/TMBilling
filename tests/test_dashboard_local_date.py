from datetime import date
from app import create_app, db
from app.services.dashboard import dashboard_service
from app.services.dashboard.dashboard_service import DashboardService


def test_dashboard_uses_local_today(monkeypatch):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-dashboard-date"})
    seen = {}
    monkeypatch.setattr(dashboard_service.PCService, "get_all", staticmethod(lambda aktif_only=True: []))
    monkeypatch.setattr(dashboard_service, "get_today_local_date", lambda: date(2026, 1, 2), raising=False)
    monkeypatch.setattr(DashboardService, "_get_omzet", staticmethod(lambda d: seen.update(d=d) or (0, 0)))
    with app.app_context():
        db.create_all()
        DashboardService.get_pc_list()
    assert seen["d"] == date(2026, 1, 2)
