# tests/test_uptime_billing_flag.py
import unittest

from app import create_app
from app.models import db, Grup, PC, Paket, Sesi, Settings, now_local
from app.services.cache.uptime_store import UptimeMemoryStore


class TestBillingFlag(unittest.TestCase):
    IP = "10.8.0.1"
    MAC = "AA:BB:CC:DD:EE:88"

    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-billing-flag",
            "CLIENT_API_KEY": "test-client-key",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        db.session.add(Settings(key="client_polling_interval_seconds", value="5"))
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        pc = PC(kode="TM-88", nama="TM-88", grup_id=grup.id,
                ip_address=self.IP, mac_address=self.MAC, aktif=True)
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
        db.session.add_all([pc, paket])
        db.session.commit()
        self.pc_id = pc.id
        self.paket_id = paket.id

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _poll(self):
        return self.app.test_client().post(
            "/api/v1/public/client/status",
            json={"ip_address": self.IP, "mac_address": self.MAC},
            headers={"X-Client-Key": self.app.config["CLIENT_API_KEY"]},
        )

    def test_default_is_not_billing(self):
        self.assertFalse(UptimeMemoryStore.is_billing(self.pc_id))

    def test_status_poll_marks_billing(self):
        sesi = Sesi(tipe="guest", nama_guest="G88", pc_id=self.pc_id, paket_id=self.paket_id,
                    durasi_beli_menit=60, total_bayar=5000, status="aktif", token_sesi="d" * 20)
        db.session.add(sesi)
        db.session.commit()
        self._poll()
        self.assertTrue(UptimeMemoryStore.is_billing(self.pc_id))

    def test_status_poll_without_session_clears_billing(self):
        UptimeMemoryStore.set_billing(self.pc_id, True)
        self._poll()
        self.assertFalse(UptimeMemoryStore.is_billing(self.pc_id))
