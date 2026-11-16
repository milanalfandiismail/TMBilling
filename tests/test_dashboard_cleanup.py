import unittest
from unittest.mock import patch

from app import create_app
from app.services.dashboard.dashboard_service import DashboardService


class TestDashboardCleanup(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-dashboard-cleanup",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    def test_get_pc_list_does_not_run_cleanup(self):
        with patch("app.services.dashboard.dashboard_service.SesiService") as sesi:
            DashboardService.get_pc_list()
        sesi.cleanup_expired.assert_not_called()
        sesi.cleanup_inactive_admin_sessions.assert_not_called()
