import unittest
from unittest.mock import patch

from app import create_app
from app.models import db, Settings
from app.services.cache.system_cache_store import SettingsCacheStore
from app.services.settings.settings_service import SettingsService


class TestSettingsCacheStore(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-cache",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        SettingsCacheStore.invalidate()

    def tearDown(self):
        SettingsCacheStore.invalidate()
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_get_all_after_invalidate_does_not_raise(self):
        db.session.add(Settings(key="warnet_title", value="Cache Test"))
        db.session.commit()
        SettingsCacheStore.invalidate()
        self.assertEqual(SettingsService.get_all()["warnet_title"], "Cache Test")

    def test_update_dict_writes_cache_without_query(self):
        SettingsCacheStore.update_dict({"warnet_title": "Langsung"})
        self.assertEqual(SettingsCacheStore.get("warnet_title"), "Langsung")

    def test_warmup_query_runs_outside_lock(self):
        seen = {}
        original = SettingsCacheStore._load_from_db

        def probe():
            seen["locked"] = SettingsCacheStore._lock.locked()
            return original()

        with patch.object(SettingsCacheStore, "_load_from_db", side_effect=probe):
            SettingsCacheStore.invalidate()
            SettingsCacheStore.get_all()
        self.assertFalse(seen["locked"])
