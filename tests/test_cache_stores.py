"""Unit tests untuk TTL ProcessMemoryStore dan rebuild PCNetworkCacheStore di luar lock."""

import time
import unittest
from unittest import mock

from app import create_app
from app.models import db, Grup, PC
from app.services.cache.system_cache_store import PCNetworkCacheStore
from app.services.cache.telemetry_store import ProcessMemoryStore


class TestCacheStores(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-cache-stores",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        PCNetworkCacheStore.clear()
        ProcessMemoryStore.clear()

    def tearDown(self):
        PCNetworkCacheStore.clear()
        ProcessMemoryStore.clear()
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_process_store_prunes_stale_entries(self):
        ProcessMemoryStore.set(1, [{"name": "a.exe"}])
        ProcessMemoryStore._timestamps[1] = 0
        ProcessMemoryStore.set(2, [{"name": "b.exe"}])
        self.assertEqual(ProcessMemoryStore.get(1), [])
        self.assertEqual(ProcessMemoryStore.get(2), [{"name": "b.exe", "title": ""}])

    def test_process_store_keeps_fresh_entries(self):
        ProcessMemoryStore.set(1, [{"name": "a.exe"}])
        ProcessMemoryStore.set(2, [{"name": "b.exe"}])
        self.assertEqual(ProcessMemoryStore.get(1), [{"name": "a.exe", "title": ""}])
        self.assertEqual(ProcessMemoryStore.get(2), [{"name": "b.exe", "title": ""}])
        self.assertGreater(ProcessMemoryStore.get_last_updated(2), 0)

    def test_resolve_pc_returns_entry_after_rebuild(self):
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        db.session.add(PC(kode="TM-1", nama="TM-1", grup_id=grup.id,
                          ip_address="10.1.0.1", aktif=True))
        db.session.commit()
        entry = PCNetworkCacheStore.resolve_pc(ip="10.1.0.1")
        self.assertEqual(entry["kode"], "TM-1")

    def test_rebuild_queries_db_outside_lock(self):
        """Query DB tidak boleh dieksekusi saat lock global cache dipegang."""
        observed = []

        class FakeQuery:
            def all(self):
                observed.append(PCNetworkCacheStore._lock.locked())
                return []

        with mock.patch.object(PC, "query", FakeQuery()):
            self.assertIsNone(PCNetworkCacheStore.resolve_pc(ip="10.9.9.9"))

        self.assertEqual(observed, [False])


if __name__ == "__main__":
    unittest.main()
