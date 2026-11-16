import unittest
from datetime import date
from unittest import mock

from sqlalchemy import event

from app import create_app
from app.models import db, Grup, PC, PCUptimeLog


def count_queries(fn):
    counter = {"n": 0}

    def _before(conn, cursor, statement, params, context, executemany):
        counter["n"] += 1

    event.listen(db.engine, "before_cursor_execute", _before)
    try:
        result = fn()
    finally:
        event.remove(db.engine, "before_cursor_execute", _before)
    return result, counter["n"]


class TestUptimeReport(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-uptime-report",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler", warna="#888888")
        db.session.add(grup)
        db.session.flush()
        self.today = date(2026, 11, 4)
        for i in range(10):
            pc = PC(kode=f"TM-{i+1:02d}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            db.session.flush()
            db.session.add(PCUptimeLog(
                pc_id=pc.id, tanggal=self.today, total_online_seconds=3600,
                total_billing_seconds=1800,
            ))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_range_report_query_count_is_constant(self):
        from app.services.hardware.uptime_service import UptimeService
        result, queries = count_queries(
            lambda: UptimeService.get_range_report(self.today, self.today))
        self.assertEqual(len(result["pcs"]), 10)
        self.assertLessEqual(queries, 2)

    def test_daily_report_does_not_flush(self):
        from app.services.hardware.uptime_service import UptimeService
        with mock.patch.object(UptimeService, "flush_uptime_to_db") as fake:
            UptimeService.get_daily_report(self.today)
        fake.assert_not_called()
