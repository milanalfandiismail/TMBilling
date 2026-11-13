import pytest

from app import create_app
from app.models import db, Grup, Member, Paket, PC, Sesi, User
from app.services.grup.grup_service import GrupService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_archive_lalu_restore_grup(ctx):
    grup = GrupService.create({"nama": "zona-uji", "warna": "#111111"})

    GrupService.archive(grup.id)
    assert db.session.get(Grup, grup.id).aktif is False
    assert grup not in GrupService.get_all()

    GrupService.restore(grup.id)
    assert db.session.get(Grup, grup.id).aktif is True
    assert grup in GrupService.get_all()


def test_restore_grup_yang_tidak_diarsip_ditolak(ctx):
    grup = GrupService.create({"nama": "zona-aktif"})
    with pytest.raises(ValueError, match="tidak dalam arsip"):
        GrupService.restore(grup.id)


def _isi_grup(grup):
    """Satu PC, satu paket, dan satu member aktif di dalam grup."""
    db.session.add_all([
        PC(kode=f"PC-{grup.id}", grup_id=grup.id),
        Paket(nama=f"paket-{grup.id}", durasi_menit=60, harga=5000, grup_id=grup.id),
        Member(username=f"member{grup.id}", password_hash="x", grup_id=grup.id),
    ])
    db.session.commit()


def test_archive_grup_ikut_mengarsipkan_pc_paket_member(ctx):
    grup = GrupService.create({"nama": "zona-cascade"})
    _isi_grup(grup)

    GrupService.archive(grup.id)

    assert db.session.get(Grup, grup.id).aktif is False
    assert PC.query.filter_by(grup_id=grup.id, aktif=True).count() == 0
    assert Paket.query.filter_by(grup_id=grup.id, aktif=True).count() == 0
    assert Member.query.filter_by(grup_id=grup.id, aktif=True).count() == 0


def test_archive_grup_ditolak_bila_ada_sesi_aktif(ctx):
    grup = GrupService.create({"nama": "zona-sesi"})
    _isi_grup(grup)
    pc = PC.query.filter_by(grup_id=grup.id).first()
    db.session.add(Sesi(tipe="guest", pc_id=pc.id, status="aktif"))
    db.session.commit()

    with pytest.raises(ValueError, match="Masih ada sesi aktif di grup ini"):
        GrupService.archive(grup.id)
    assert db.session.get(Grup, grup.id).aktif is True


def test_restore_grup_tidak_menghidupkan_pc_terarsip(ctx):
    grup = GrupService.create({"nama": "zona-pulih"})
    _isi_grup(grup)
    GrupService.archive(grup.id)

    GrupService.restore(grup.id)

    assert db.session.get(Grup, grup.id).aktif is True
    assert PC.query.filter_by(grup_id=grup.id, aktif=True).count() == 0


def test_route_arsip_dan_restore_grup(ctx):
    grup = GrupService.create({"nama": "zona-route"})
    admin = User(username="admin_arsip", password_hash="x", role="admin", aktif=True)
    db.session.add(admin)
    db.session.commit()

    client = ctx.test_client()
    with client.session_transaction() as s:
        s["kasir_id"] = admin.id
        s["kasir_username"] = admin.username
        s["kasir_role"] = "admin"

    res = client.post(f"/api/v1/kasir/grup/{grup.id}/archive")
    assert res.status_code == 200
    assert db.session.get(Grup, grup.id).aktif is False

    res = client.post(f"/api/v1/kasir/grup/{grup.id}/restore")
    assert res.status_code == 200
    assert db.session.get(Grup, grup.id).aktif is True

    res = client.post("/api/v1/kasir/grup/999999/restore")
    assert res.status_code == 400
