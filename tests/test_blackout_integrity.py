from datetime import timedelta
import pytest
from app import create_app
from app.models import db, Grup, PC, Paket, Sesi, now_local
from app.services.blackout.blackout_service import BlackoutService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup); db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=12000, grup_id=grup.id, aktif=True)
        pcs = [PC(kode=f"PC0{i}", nama=f"PC 0{i}", grup_id=grup.id) for i in (1, 2)]
        db.session.add_all([paket, *pcs]); db.session.commit()
        yield {"paket": paket, "pcs": pcs}
        db.session.remove(); db.drop_all()


def test_deteksi_memakai_last_sync_sebagai_selesai_pada(ctx):
    last_sync = now_local() - timedelta(minutes=90)
    sesi = Sesi(tipe="guest", nama_guest="Mati", pc_id=ctx["pcs"][0].id, paket_id=ctx["paket"].id,
                durasi_beli_menit=120, total_bayar=24000, status="aktif",
                mulai_pada=last_sync - timedelta(minutes=30), waktu_mulai_sesi=last_sync - timedelta(minutes=30),
                last_sync=last_sync, token_sesi="x" * 64)
    db.session.add(sesi); db.session.commit()

    BlackoutService.deteksi(menit_threshold=60)

    sesi = db.session.get(Sesi, sesi.id)
    assert sesi.selesai_pada.replace(microsecond=0) == last_sync.replace(microsecond=0)
    assert sesi.menit_terpakai() == 30


def test_resolve_guest_sama_mengisi_selesai_pada(ctx):
    sesi = Sesi(tipe="guest", nama_guest="Mati", pc_id=ctx["pcs"][0].id, paket_id=ctx["paket"].id,
                durasi_beli_menit=60, total_bayar=12000, status="selesai",
                is_blackout_suspect=True, sisa_menit_saat_mati=40, token_sesi="y" * 64)
    db.session.add(sesi); db.session.commit()

    BlackoutService.resolve_guest_sama(sesi.id, operator="kasir")

    sesi = db.session.get(Sesi, sesi.id)
    assert sesi.selesai_pada is not None


def test_resolve_member_ditolak_bila_member_sudah_punya_sesi_aktif(ctx):
    from app.models import Member
    member = Member(username="m1", nama_lengkap="M", grup_id=ctx["pcs"][0].grup_id,
                    password_hash="x", waktu_tersimpan=10, aktif=True)
    db.session.add(member); db.session.commit()
    sesi = Sesi(tipe="member", member_id=member.id, pc_id=ctx["pcs"][0].id, paket_id=ctx["paket"].id,
                durasi_beli_menit=60, total_bayar=12000, status="selesai",
                is_blackout_suspect=True, sisa_menit_saat_mati=40, token_sesi="z" * 64)
    sesi_baru = Sesi(tipe="member", member_id=member.id, pc_id=ctx["pcs"][1].id, paket_id=ctx["paket"].id,
                     durasi_beli_menit=60, total_bayar=12000, status="aktif", token_sesi="w" * 64)
    db.session.add_all([sesi, sesi_baru]); db.session.commit()

    with pytest.raises(ValueError, match="sesi aktif"):
        BlackoutService.resolve_member(sesi.id, operator="kasir")

    assert db.session.get(Member, member.id).waktu_tersimpan == 10


def test_resolve_member_tidak_menghidupkan_saldo_kadaluarsa(ctx):
    from app.models import Member
    member = Member(username="m2", nama_lengkap="M", grup_id=ctx["pcs"][0].grup_id,
                    password_hash="x", waktu_tersimpan=0, aktif=True,
                    kadaluarsa_pada=now_local() - timedelta(days=1))
    db.session.add(member); db.session.commit()
    sesi = Sesi(tipe="member", member_id=member.id, pc_id=ctx["pcs"][0].id, paket_id=ctx["paket"].id,
                durasi_beli_menit=60, total_bayar=12000, status="selesai",
                is_blackout_suspect=True, sisa_menit_saat_mati=40, token_sesi="v" * 64)
    db.session.add(sesi); db.session.commit()

    BlackoutService.resolve_member(sesi.id, operator="kasir")

    assert db.session.get(Member, member.id).waktu_tersimpan == 0
