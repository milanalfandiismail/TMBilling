import unittest

from sqlalchemy import event

from app import create_app
from app.models import db, Grup, PC


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


class TestTVCache(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-tv-cache",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        for i in range(5):
            db.session.add(PC(kode=f"TM-{i+1}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True))
        db.session.commit()
        from app.services.public.tv_service import TVSignageService
        TVSignageService.invalidate_cache()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()
        from app.services.public.tv_service import TVSignageService
        TVSignageService.invalidate_cache()

    def test_second_call_within_ttl_hits_no_database(self):
        from app.services.public.tv_service import TVSignageService
        first = TVSignageService.get_live_data()
        second, queries = count_queries(TVSignageService.get_live_data)
        self.assertEqual(first["occupancy"]["total_pc"], 5)
        self.assertEqual(queries, 0)
        self.assertIs(first, second)
