# tests/test_shift_summary_readonly.py
import unittest
from app import create_app
from app.models import db, User, ShiftRecord, Transaksi, now_local
from app.services import ShiftService


class TestShiftSummaryReadOnly(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

        kasir = User(username="kasir_ro", nama_lengkap="Kasir RO", role="kasir", aktif=True)
        kasir.set_password("rahasia123")
        db.session.add(kasir)
        db.session.commit()

        self.shift = ShiftRecord(kasir_id=kasir.id, waktu_mulai=now_local(), modal_awal=0, status="AKTIF")
        db.session.add(self.shift)
        db.session.commit()

        db.session.add(Transaksi(
            user_id=kasir.id, jumlah=50000, jenis="buka_sesi",
            metode_pembayaran="Tunai", dibuat_pada=now_local(), no_nota="TM-TEST-001",
        ))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_summary_does_not_write_to_shift_row(self):
        summary = ShiftService.get_shift_summary(self.shift.id)
        self.assertEqual(summary["total_billing"], 50000)
        db.session.expire_all()
        row = db.session.get(ShiftRecord, self.shift.id)
        self.assertEqual(row.total_billing, 0)   # tidak ditulis oleh GET
        self.assertIsNone(row.detail_metode_json)

    def test_force_close_leaves_cash_count_empty(self):
        ShiftService.force_close_shift(self.shift.id, "admin", "mati lampu")
        db.session.expire_all()
        row = db.session.get(ShiftRecord, self.shift.id)
        self.assertEqual(row.status, "SELESAI")
        self.assertIsNone(row.uang_fisik)
        self.assertIsNone(row.selisih)
        self.assertIn("[FORCE CLOSE", row.catatan)


if __name__ == "__main__":
    unittest.main()
