# tests/test_sesi_branch_validation.py
import pytest
from app import create_app
from app.models import db, Grup, PC, Paket, Sesi
from app.services.sesi.sesi_service import SesiService
from app.services.branch.branch_service import BranchService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        g = Grup(nama="reguler", keterangan="Reguler Zone", warna="#888888")
        db.session.add(g)
        db.session.commit()
        
        pc1 = PC(kode="PC01", nama="PC 01", grup_id=g.id)
        pc2 = PC(kode="PC02", nama="PC 02", grup_id=g.id)
        pkt = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=5000, grup_id=g.id, aktif=True)
        db.session.add_all([pc1, pc2, pkt])
        db.session.commit()
        
        yield app
        db.session.remove()
        db.drop_all()


def test_buka_guest_validation(app_context):
    pkt = Paket.query.first()
    
    # Valid guest
    sesi = SesiService.buka_guest("PC01", pkt.id, nama_guest="Budi Gaming")
    assert sesi.nama_guest == "Budi Gaming"

    # Invalid long guest name
    with pytest.raises(ValueError, match="Nama Guest maksimal 50 karakter"):
        SesiService.buka_guest("PC02", pkt.id, nama_guest="A" * 51)


def test_pindah_pc_to_same_pc_rejected(app_context):
    pkt = Paket.query.first()
    sesi = SesiService.buka_guest("PC01", pkt.id, nama_guest="Player 1")
    
    # Pindah ke PC yang sama harus ditolak
    with pytest.raises(ValueError, match="Tidak dapat memindahkan sesi ke unit PC yang sama"):
        SesiService.pindah_pc(sesi.id, "PC01")


def test_branch_validation(app_context):
    # Valid add branch (with mock test_connection or skip connection error)
    # Invalid short API Key (< 16 chars)
    ok, msg = BranchService.add_branch("http://192.168.1.100:7015", "short_key")
    assert ok is False
    assert "minimal 16 karakter" in str(msg)
