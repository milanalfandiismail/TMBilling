from datetime import timedelta
import pytest
from app import create_app, db
from app.models import Grup, PC, Sesi, Transaksi, now_local
from app.services.report.log_audit_service import LogAuditService


def test_tanggal_lama_dengan_sesi_aktif_ditolak():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-GUARD", nama="PC Guard", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()

        kemarin = now_local() - timedelta(days=1)
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
                kemarin.strftime("%Y-%m-%d"), operator="admin"
            )

        assert Transaksi.query.filter_by(no_nota="TM-GUARD-001").count() == 1
