from datetime import timedelta

import pytest

from app import create_app
from app.models import db, Grup, Member, PC, Paket, Sesi, Transaksi, now_local
from app.services.blackout.blackout_service import BlackoutService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.flush()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=12000, grup_id=grup.id, aktif=True)
        pcs = [PC(kode=f"PC0{i}", nama=f"PC 0{i}", grup_id=grup.id) for i in (1, 2)]
        member = Member(username="m-force", nama_lengkap="M", grup_id=grup.id, waktu_tersimpan=0, aktif=True)
        member.set_password("x")
        db.session.add_all([paket, *pcs, member])
        db.session.commit()
        yield {"paket": paket, "pcs": pcs, "member": member}
        db.session.remove()
        db.drop_all()


def _guest(pc, paket, base):
    return Sesi(
        tipe="guest", nama_guest="Tamu", pc_id=pc.id, paket_id=paket.id,
        durasi_beli_menit=60, total_bayar=12000, status="aktif",
        mulai_pada=base - timedelta(minutes=10), waktu_mulai_sesi=base - timedelta(minutes=10),
        last_sync=base, token_sesi="f" * 64,
    )


def _tutup_sesi_count(sesi_id):
    return Transaksi.query.filter_by(sesi_id=sesi_id, jenis="tutup_sesi").count()


def test_force_close_marks_fresh_guest_as_blackout(ctx):
    base = now_local().replace(microsecond=0)
    sesi = _guest(ctx["pcs"][0], ctx["paket"], base)
    db.session.add(sesi)
    db.session.commit()

    hasil = BlackoutService.force_all_and_detect(operator="kasir")
    assert hasil == {"tutup": 1, "deteksi": 1}

    db.session.expire_all()
    sesi = db.session.get(Sesi, sesi.id)
    assert sesi.status == "selesai"
    assert sesi.is_blackout_suspect is True
    assert sesi.is_blackout_resolved is False
    assert sesi.sisa_menit_saat_mati == 50
    assert any(s.id == sesi.id for s in BlackoutService.get_audit_list())

    transaksi = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="tutup_sesi").all()
    assert len(transaksi) == 1
    assert transaksi[0].jumlah == 0

    BlackoutService.force_all_and_detect(operator="kasir")
    assert _tutup_sesi_count(sesi.id) == 1


def test_force_close_saves_member_snapshot_and_close_transaction(ctx):
    base = now_local().replace(microsecond=0)
    sesi = Sesi(
        tipe="member", member_id=ctx["member"].id, pc_id=ctx["pcs"][1].id,
        paket_id=ctx["paket"].id, durasi_beli_menit=60, total_bayar=12000,
        status="aktif", mulai_pada=base - timedelta(minutes=10),
        waktu_mulai_sesi=base - timedelta(minutes=10), waktu_tersimpan_awal=60,
        last_sync=base, token_sesi="g" * 64,
    )
    db.session.add(sesi)
    db.session.commit()

    BlackoutService.force_all_and_detect(operator="kasir")

    db.session.expire_all()
    sesi = db.session.get(Sesi, sesi.id)
    assert sesi.is_blackout_suspect is True
    assert sesi.sisa_menit_saat_mati == 50
    assert db.session.get(Member, ctx["member"].id).waktu_tersimpan == 50
    assert _tutup_sesi_count(sesi.id) == 1
