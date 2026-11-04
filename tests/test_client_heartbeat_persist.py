# tests/test_client_heartbeat_persist.py
import unittest

from app import create_app
from app.models import db, Grup, PC, Paket, Sesi, Settings, now_local
from app.services.cache.memory_store import OnlineStatusStore
from app.services.client.client_service import ClientService


class TestClientHeartbeatPersist(unittest.TestCase):
    IP = "10.9.0.1"
    MAC = "AA:BB:CC:DD:EE:99"

    def setUp(self):
        self.app = create_app({
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-heartbeat",
            "CLIENT_API_KEY": "test-client-key",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        OnlineStatusStore.clear()
        db.create_all()

        db.session.add(Settings(key="client_polling_interval_seconds", value="5"))
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        pc = PC(kode="TM-99", nama="TM-99", grup_id=grup.id,
                ip_address=self.IP, mac_address=self.MAC, aktif=True)
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000,
                      grup_id=grup.id, aktif=True)
        db.session.add_all([pc, paket])
        db.session.commit()

        sesi = Sesi(tipe="guest", nama_guest="Guest99", pc_id=pc.id,
                    paket_id=paket.id, durasi_beli_menit=60, total_bayar=5000,
                    status="aktif", token_sesi="b" * 20)
        db.session.add(sesi)
        db.session.commit()
        self.pc_id = pc.id
        self.sesi_id = sesi.id
        db.session.remove()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()
        OnlineStatusStore.clear()

    def _poll(self):
        return self.app.test_client().post(
            "/api/v1/public/client/status",
            json={"ip_address": self.IP, "mac_address": self.MAC},
            headers={"X-Client-Key": self.app.config["CLIENT_API_KEY"]},
        )

    def _db_pc(self):
        db.session.remove()
        return db.session.get(PC, self.pc_id)

    def _capture_sql(self, fn):
        from sqlalchemy import event
        stmts = []

        def _rec(conn, cursor, statement, params, context, executemany):
            stmts.append(" ".join(statement.split())[:80].upper())

        event.listen(db.engine, "before_cursor_execute", _rec)
        try:
            fn()
        finally:
            event.remove(db.engine, "before_cursor_execute", _rec)
        return stmts

    # Catatan: cek `db.session.dirty` tidak dipakai — autoflush di query berikutnya
    # mengosongkan dirty walau UPDATE pc sudah dieksekusi. Yang benar: hitung statement.
    def test_poll_issues_no_pc_update(self):
        stmts = self._capture_sql(
            lambda: ClientService.get_status(self.IP, self.MAC, role="guest"))
        self.assertFalse(
            [s for s in stmts if s.startswith("UPDATE PC")],
            f"polling masih menulis pc.last_activity: {stmts}")

    def test_poll_keeps_pc_last_activity_empty_in_db(self):
        self.assertIsNone(self._db_pc().last_activity)
        self._poll()
        self.assertIsNone(self._db_pc().last_activity)

    def test_poll_still_marks_pc_online_in_ram(self):
        self._poll()
        self.assertTrue(OnlineStatusStore.is_online(self.pc_id, timeout_seconds=10))
