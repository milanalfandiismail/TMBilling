from app import create_app, db
from app.models import Grup, Member, Paket, PC, Sesi, Transaksi
from app.models.base.base import now_local
from app.services.report.report_service import ReportService
import pytest


@pytest.fixture()
def ctx(tmp_path):
    db_path = str(tmp_path / 'kategori.db')
    app = create_app({
        'TESTING': True,
        'WTF_CSRF_ENABLED': False,
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}',
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama='reguler')
        db.session.add(grup)
        db.session.commit()
        paket = Paket(nama='1 Jam', durasi_menit=60, harga=50000, grup_id=grup.id, aktif=True)
        member = Member(username='m1', nama_lengkap='M1', grup_id=grup.id, password_hash='x')
        pc = PC(kode='PC01', nama='PC01', grup_id=grup.id)
        db.session.add_all([paket, member, pc])
        db.session.commit()
        sesi = Sesi(pc_id=pc.id, tipe='guest', nama_guest='G1', durasi_beli_menit=60, total_bayar=50000, status='selesai')
        db.session.add(sesi)
        db.session.commit()
        yield {'app': app, 'sesi_id': sesi.id, 'member_id': member.id, 'paket_id': paket.id}


def _trx(jenis, jumlah, **kwargs):
    trx = Transaksi(jenis=jenis, jumlah=jumlah, dibuat_pada=now_local(), **kwargs)
    db.session.add(trx)
    db.session.commit()


def test_refund_hari_sama_menetralkan_kategori(ctx):
    _trx('beli_paket_guest', 50000, sesi_id=ctx['sesi_id'], paket_id=ctx['paket_id'])
    _trx('refund_paket', -50000, sesi_id=ctx['sesi_id'], paket_id=ctx['paket_id'])
    _trx('beli_paket_member', 30000, member_id=ctx['member_id'], paket_id=ctx['paket_id'])
    _trx('refund_paket', -30000, member_id=ctx['member_id'], paket_id=ctx['paket_id'])
    with ctx['app'].app_context():
        assert ReportService.get_pendapatan_kategori(None, 'guest') == 0
        assert ReportService.get_pendapatan_kategori(None, 'member') == 0


def test_kategori_tidak_saling_bocor(ctx):
    _trx('beli_paket_guest', 50000, sesi_id=ctx['sesi_id'], paket_id=ctx['paket_id'])
    _trx('beli_paket_member', 30000, member_id=ctx['member_id'], paket_id=ctx['paket_id'])
    with ctx['app'].app_context():
        assert ReportService.get_pendapatan_kategori(None, 'guest') == 50000
        assert ReportService.get_pendapatan_kategori(None, 'member') == 30000

