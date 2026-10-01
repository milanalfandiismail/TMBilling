# tests/test_operational_services_validation.py
import pytest
from app import create_app, db
from app.models import User, ShiftRecord
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
from app.services.shift.shift_service import ShiftService
from app.services.tournament.tournament_service import TournamentService
from app.services.tutorial.tutorial_service import TutorialService
from app.services.notes.note_service import NoteService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        # Create test kasir
        kasir = User(username="kasir1", nama_lengkap="Kasir Satu", role="kasir")
        kasir.set_password("kasir123")
        db.session.add(kasir)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def test_ip_whitelist_service_validation(app_context):
    # Valid IP addition
    entries = IpWhitelistService.add("192.168.1.50", label="PC Kasir")
    assert any(e["ip"] == "192.168.1.50" for e in entries)

    # Invalid IP format
    with pytest.raises(ValueError, match="Format alamat IP tidak valid"):
        IpWhitelistService.add("invalid.ip.address", label="Test")

    with pytest.raises(ValueError, match="Alamat IP tidak boleh kosong"):
        IpWhitelistService.add("", label="Test")


def test_shift_service_validation(app_context):
    # Invalid modal awal (out of bound)
    with pytest.raises(ValueError, match="Modal Awal"):
        ShiftService.start_shift("kasir1", modal_awal=-1000)

    # Valid shift start
    shift = ShiftService.start_shift("kasir1", modal_awal=50000, operator="admin")
    assert shift.modal_awal == 50000

    # Invalid uang fisik on close (negative)
    with pytest.raises(ValueError, match="Uang Fisik"):
        ShiftService.end_shift(shift.id, uang_fisik=-500, operator="admin")


def test_tournament_service_validation(app_context):
    # Valid tournament
    t_data = {
        "nama": "Turnamen Valorant 2026",
        "deskripsi": "Kompetisi warnet",
        "tipe_jalur": "playoff",
        "bo_format": 3,
        "teams": ["Tim Alpha", "Tim Beta", "Tim Gamma", "Tim Delta"]
    }
    res = TournamentService.create_tournament(t_data)
    assert res["nama"] == "Turnamen Valorant 2026"

    # Invalid nama turnamen length (< 2)
    with pytest.raises(ValueError, match="Nama Turnamen"):
        TournamentService.create_tournament({
            "nama": "T",
            "teams": ["Tim 1", "Tim 2"]
        })

    # Invalid bo_format (> 9)
    with pytest.raises(ValueError, match="Format BO"):
        TournamentService.create_tournament({
            "nama": "Turnamen BO 99",
            "bo_format": 99,
            "teams": ["Tim 1", "Tim 2"]
        })


def test_tutorial_service_validation(app_context):
    # Valid tutorial
    tut = TutorialService.create({
        "title": "Cara Topup Saldo Member",
        "category": "Billing",
        "content": "Langkah-langkah topup saldo member melalui dashboard kasir."
    })
    assert tut.title == "Cara Topup Saldo Member"

    # Too short title
    with pytest.raises(ValueError, match="Judul Panduan"):
        TutorialService.create({
            "title": "AB",
            "category": "Billing",
            "content": "Konten valid yang cukup panjang"
        })


def test_note_service_validation(app_context):
    import time
    title = f"SOP Kasir {int(time.time())}"
    note = NoteService.create_note(title, "Isi catatan operasional pagi.")
    assert note["title"] == title

    # Invalid directory traversal attempt in note path
    with pytest.raises(ValueError, match="Akses tidak sah"):
        NoteService.validate_path("../../etc/shadow")

