import unittest
from app import create_app
from app.models import db, PC, Grup, Sesi, now_local
from app.services.dashboard.dashboard_service import DashboardService

class TestDashboardBulkPerf(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app_context = self.app.app_context()
        self.app_context.push()

        self.grup = Grup.query.filter_by(nama="regular").first()
        if not self.grup:
            self.grup = Grup(nama="regular", warna="#3b82f6")
            db.session.add(self.grup)
            db.session.commit()

        # Pastikan tidak ada PC duplicate dari run sebelumnya
        PC.query.filter_by(kode="PC-BULK-01").delete()
        db.session.commit()

        self.pc = PC(kode="PC-BULK-01", nama="PC Bulk 01", ip_address="192.168.1.101", grup_id=self.grup.id, aktif=True)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        if hasattr(self, 'pc') and self.pc:
            Sesi.query.filter_by(pc_id=self.pc.id).delete()
            PC.query.filter_by(kode="PC-BULK-01").delete()
            db.session.commit()
        db.session.remove()
        self.app_context.pop()

    def test_get_pc_list_with_active_session_bulk(self):
        # Tambah sesi aktif
        sesi = Sesi(
            pc_id=self.pc.id,
            status="aktif",
            tipe="guest",
            nama_guest="Budi",
            durasi_beli_menit=60,
            total_bayar=10000,
            mulai_pada=now_local()
        )
        db.session.add(sesi)
        db.session.commit()

        data = DashboardService.get_pc_list()
        assert "pc_list" in data
        assert len(data["pc_list"]) == 1
        pc_res = data["pc_list"][0]
        assert pc_res["kode"] == "PC-BULK-01"
        assert pc_res["status"] == "terpakai"
        assert pc_res["sesi_detail"] is not None
        assert pc_res["sesi_detail"]["nama_guest"] == "Budi"


class TestDashboardOmzetCache(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-omzet-cache",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_omzet_aggregates_cached_within_ttl(self):
        from datetime import date
        from unittest.mock import patch
        from app.services.dashboard.dashboard_service import DashboardService

        DashboardService.clear_omzet_cache()
        with patch("app.services.dashboard.dashboard_service.TransaksiRepository.get_total_pendapatan_hari_ini", return_value=1000) as billing, \
             patch("app.services.dashboard.dashboard_service.MenuRepository.get_total_pemasukan_by_date", return_value=500) as menu:
            first = DashboardService._get_omzet(date.today())
            second = DashboardService._get_omzet(date.today())
        self.assertEqual(first, (1000, 500))
        self.assertEqual(second, (1000, 500))
        self.assertEqual(billing.call_count, 1)
        self.assertEqual(menu.call_count, 1)
