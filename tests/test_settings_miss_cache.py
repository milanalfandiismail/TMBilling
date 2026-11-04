import unittest
from unittest.mock import patch

from sqlalchemy import event

from app import create_app
from app.models import db, Settings


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


class TestSettingsMissCache(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-settings-miss",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        from app.services.cache.system_cache_store import SettingsCacheStore
        SettingsCacheStore.invalidate()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()
        from app.services.cache.system_cache_store import SettingsCacheStore
        SettingsCacheStore.invalidate()

    def test_missing_key_hits_database_once(self):
        from app.services.settings.settings_service import SettingsService
        result, queries = count_queries(
            lambda: [SettingsService.get("tidak_ada_key", "cadangan") for _ in range(5)])
        self.assertEqual(result, ["cadangan"] * 5)
        self.assertEqual(queries, 1)

    def test_set_clears_missing_marker(self):
        from app.services.settings.settings_service import SettingsService
        self.assertEqual(SettingsService.get("baru", "x"), "x")
        db.session.add(Settings(key="baru", value="y"))
        db.session.commit()
        SettingsService.set("baru", "y")
        self.assertEqual(SettingsService.get("baru", "x"), "y")

    def test_get_all_then_missing_key_issues_no_query(self):
        from app.services.cache.system_cache_store import SettingsCacheStore
        from app.services.settings.settings_service import SettingsService
        SettingsCacheStore.invalidate()
        SettingsService.get_all()
        result, queries = count_queries(
            lambda: SettingsService.get("tidak_ada_key", "cadangan"))
        self.assertEqual(result, "cadangan")
        self.assertEqual(queries, 0)

    def test_get_all_marks_snapshot_complete_after_cache_load_failed(self):
        """update_dict() menerima SELURUH tabel -> snapshot jadi lengkap, cache negatif tak dikalahkan."""
        from app.services.cache.system_cache_store import SettingsCacheStore
        from app.services.settings.settings_service import SettingsService
        db.session.add(Settings(key="ada_key", value="1"))
        db.session.commit()
        SettingsCacheStore.invalidate()
        # Load cache dari DB gagal -> service fallback ke repository & update_dict(seluruh tabel)
        with patch.object(SettingsCacheStore, "_load_from_db", return_value=None):
            SettingsService.get_all()
        result, queries = count_queries(
            lambda: SettingsService.get("tidak_ada_key", "cadangan"))
        self.assertEqual(result, "cadangan")
        self.assertEqual(queries, 0)
