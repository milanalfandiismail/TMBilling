import unittest

from sqlalchemy import event

from app import create_app
from app.models import db, Grup, PC, HardwareMonitor


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


class TestHardwareListQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-query-count",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        for i in range(5):
            pc = PC(kode=f"TM-{i+1}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            db.session.flush()
            db.session.add(HardwareMonitor(pc_id=pc.id, cpu_name="i5", gpu_name="RTX"))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_hardware_list_query_count_is_constant(self):
        from app.services.hardware.hardware_service import HardwareService
        monitors, queries = count_queries(HardwareService.get_all_with_pc)
        for m in monitors:
            _ = m.pc.kode, m.pc.grup.nama
        self.assertEqual(len(monitors), 5)
        self.assertLessEqual(queries, 4)
