import pytest
import unittest
from unittest.mock import MagicMock, patch
from datetime import timedelta

from app import create_app
from app.models import db, Grup, PC, Paket, Sesi, now_local

def make_mock_transaksi(paket_nama=None, keterangan=None, metode="Tunai"):
    t = MagicMock()
    t.member = None
    t.sesi = None
    t.paket = MagicMock(nama=paket_nama) if paket_nama else None
    t.keterangan = keterangan
    t.no_nota = "TRX-001"
    t.jumlah = 10000
    t.dibuat_pada = None
    t.jenis = "beli_paket_guest"
    t.operator = None
    t.user = None
    t.metode_pembayaran = metode
    return t

def test_format_history_struk_includes_paket_nama_from_relation():
    from app.services.report.report_service import ReportService
    t = make_mock_transaksi(paket_nama="Paket 1 Jam")
    result = ReportService._format_history_struk([t])
    assert result[0]["paket_nama"] == "Paket 1 Jam"

def test_format_history_struk_fallback_to_keterangan():
    from app.services.report.report_service import ReportService
    t = make_mock_transaksi(keterangan="Tambah Waktu 30 Menit")
    result = ReportService._format_history_struk([t])
    assert result[0]["paket_nama"] == "Tambah Waktu 30 Menit"

def test_format_history_struk_dash_when_no_paket_no_keterangan():
    from app.services.report.report_service import ReportService
    t = make_mock_transaksi()
    result = ReportService._format_history_struk([t])
    assert result[0]["paket_nama"] == "-"

def test_export_billing_pdf_with_paket_column():
    from app import create_app
    from app.services.report.pdf_export_service import PdfExportService
    app = create_app()
    with app.app_context():
        data = {
            'tanggal': '2026-10-10',
            'kasir_id': None,
            'total_pendapatan_billing': 105000,
            'history_struk': [{
                'id': 1,
                'waktu': '10/10/2026 13:35',
                'no_nota': 'TM-001',
                'nama_pelanggan': 'Guest3153',
                'paket_nama': 'Reguler - 3 Jam',
                'pc_kode': 'WEW-4',
                'kasir_nama': 'kasir',
                'keterangan': 'Beli paket',
                'metode_pembayaran': 'QRIS',
                'jumlah': 13000
            }]
        }
        pdf_bytes, filename = PdfExportService.export_billing_pdf(data)
        assert filename.startswith("Laporan_Billing_2026-10-10")
        assert len(pdf_bytes) > 0
        assert pdf_bytes.startswith(b"%PDF")

def test_laporan_billing_includes_breakdown_metode():
    from app import create_app
    from app.services.report.report_service import ReportService
    app = create_app()
    with app.app_context():
        res = ReportService.get_laporan_by_tanggal("2026-10-10")
        assert "breakdown_metode" in res
        assert isinstance(res["breakdown_metode"], dict)

def test_laporan_kantin_includes_breakdown_metode():
    from app import create_app
    from app.services.report.report_service import ReportService
    app = create_app()
    with app.app_context():
        res = ReportService.get_laporan_kantin_by_tanggal("2026-10-10")
        assert "breakdown_metode" in res
        assert isinstance(res["breakdown_metode"], dict)


class TestLaporanHarian(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-report-service",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
        db.session.add(paket)
        db.session.flush()
        for i in range(3):
            pc = PC(kode=f"TM-{i+1:02d}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            db.session.flush()
            if i < 2:  # 2 sesi aktif, 1 PC kosong
                db.session.add(Sesi(
                    tipe="guest", nama_guest=f"G{i}", pc_id=pc.id, paket_id=paket.id,
                    durasi_beli_menit=60, total_bayar=5000, status="aktif",
                    mulai_pada=now_local() - timedelta(minutes=5),
                    token_sesi="c" * 20 + str(i),
                ))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_count_aktif_matches_active_rows(self):
        from app.repositories import SesiRepository
        self.assertEqual(SesiRepository.count_aktif(), 2)

    def test_laporan_harian_sesi_aktif_matches(self):
        from app.services.report.report_service import ReportService
        result = ReportService.get_laporan_harian()
        self.assertEqual(result["sesi_aktif"], 2)


