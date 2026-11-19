from datetime import datetime, timedelta
import pytest
import app.utils.timezone_utils as tz
from app import create_app, db
from app.models import Grup, PC, Sesi, Transaksi
from app.services.report.log_audit_service import LogAuditService
from app.services.settings.settings_service import SettingsService
from app.utils.timezone_utils import get_local_date_range_utc, get_today_local_date

# UTC 16:16 WITA sudah tanggal berikutnya di Asia/Makassar (UTC+8).
FREEZE_UTC = datetime(2026, 11, 11, 16, 16, 12)


def test_tanggal_lama_dengan_sesi_aktif_ditolak(monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        SettingsService.set("timezone", "Asia/Makassar")
        monkeypatch.setattr(tz, "now_utc", lambda: FREEZE_UTC)

        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-GUARD", nama="PC Guard", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()

        target = get_today_local_date() - timedelta(days=1)
        start_utc, end_utc = get_local_date_range_utc(target.isoformat())
        kemarin = start_utc + timedelta(hours=12)
        assert start_utc <= kemarin < end_utc

        sesi = Sesi(
            tipe="guest", nama_guest="Lintas Hari", pc_id=pc.id,
            status="aktif", mulai_pada=kemarin,
            waktu_mulai_sesi=kemarin,
            durasi_beli_menit=1440, total_bayar=50000,
        )
        trx = Transaksi(
            jenis="beli_paket_guest", jumlah=50000, menit=1440,
            no_nota="TM-GUARD-001", dibuat_pada=kemarin,
            metode_pembayaran="Tunai",
        )
        db.session.add_all([sesi, trx])
        db.session.commit()

        with pytest.raises(ValueError, match="sesi aktif"):
            LogAuditService.clear_transactions_by_date(
                target.isoformat(), operator="admin"
            )

        assert Transaksi.query.filter_by(no_nota="TM-GUARD-001").count() == 1
