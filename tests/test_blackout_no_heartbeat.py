from datetime import timedelta

import pytest

from app import create_app, db
from app.models import Grup, PC, Paket, Sesi, now_local
from app.services.blackout.blackout_service import BlackoutService


@pytest.fixture
def ctx(tmp_path):
    uri = 'sqlite:///' + (tmp_path / 'blackout.db').as_posix()
    app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': uri, 'INSTANCE_PATH': str(tmp_path)})
    with app.app_context():
        db.drop_all()
        db.create_all()
        grup = Grup(nama='reguler')
        db.session.add(grup)
        db.session.flush()
        paket = Paket(nama='1 Jam', durasi_menit=60, harga=10000, grup_id=grup.id, aktif=True)
        pcs = [PC(kode='PC0' + str(i), nama='PC 0' + str(i), grup_id=grup.id) for i in (1, 2)]
        db.session.add_all([paket, *pcs])
        db.session.commit()
        yield {'paket': paket, 'pcs': pcs}


def test_sesi_tanpa_heartbeat_dideteksi_blackout(ctx):
    mulai = now_local() - timedelta(minutes=90)
    mati = Sesi(tipe='guest', nama_guest='Mati', pc_id=ctx['pcs'][0].id, paket_id=ctx['paket'].id,
                durasi_beli_menit=120, total_bayar=20000, status='aktif', mulai_pada=mulai,
                waktu_mulai_sesi=mulai, last_sync=None, token_sesi='a' * 64)
    hidup = Sesi(tipe='guest', nama_guest='Hidup', pc_id=ctx['pcs'][1].id, paket_id=ctx['paket'].id,
                durasi_beli_menit=60, total_bayar=10000, status='aktif',
                mulai_pada=now_local() - timedelta(minutes=5), last_sync=now_local(), token_sesi='b' * 64)
    db.session.add_all([mati, hidup])
    db.session.commit()
    id_mati, id_hidup = mati.id, hidup.id

    BlackoutService.deteksi(menit_threshold=30)

    mati = db.session.get(Sesi, id_mati)
    hidup = db.session.get(Sesi, id_hidup)
    assert mati.is_blackout_suspect is True
    assert mati.status == 'selesai'
    assert mati.selesai_pada.replace(microsecond=0) == mulai.replace(microsecond=0)
    assert hidup.status == 'aktif'
    assert hidup.is_blackout_suspect is False
