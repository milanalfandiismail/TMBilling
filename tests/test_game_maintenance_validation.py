# tests/test_game_maintenance_validation.py
import pytest
from app import create_app, db
from app.models import PC
from app.models.game.game import Game
from app.models.game.game_kategori import GameKategori
from app.models.maintenance.maintenance import MaintenanceTicket
from app.services.game.game_service import GameService
from app.services.game.game_kategori_service import GameKategoriService
from app.services.maintenance.maintenance_service import MaintenanceService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_game_service_validation(app_context):
    # Valid creation
    game = GameService.create({
        "nama": "Valorant",
        "tipe": "game",
        "kategori": "FPS, Esports",
        "exe_path": "C:\\Riot Games\\Valorant.exe"
    })
    assert game.nama == "Valorant"
    assert game.tipe == "game"

    # Blank / invalid name length
    with pytest.raises(ValueError, match="Nama Game/Aplikasi"):
        GameService.create({"nama": ""})
    with pytest.raises(ValueError, match="Nama Game/Aplikasi"):
        GameService.create({"nama": "A"})  # too short (< 2)

    # Invalid choice for tipe
    with pytest.raises(ValueError, match="Tipe Game"):
        GameService.create({"nama": "Discord", "tipe": "invalid_type"})


def test_game_kategori_service_validation(app_context):
    # Valid creation
    kat = GameKategoriService.create({"nama": "Action RPG"})
    assert kat.nama == "Action RPG"

    # Blank / too short category name
    with pytest.raises(ValueError, match="Nama Kategori"):
        GameKategoriService.create({"nama": ""})
    with pytest.raises(ValueError, match="Nama Kategori"):
        GameKategoriService.create({"nama": "A"})  # too short


def test_maintenance_service_validation(app_context):
    from app.models.grup.grup import Grup
    grup = Grup(nama="reguler", keterangan="Reguler Zone", warna="#888888")
    db.session.add(grup)
    db.session.commit()

    pc = PC(kode="PC-01", nama="PC 01", ip_address="192.168.1.101", grup_id=grup.id, aktif=True)
    db.session.add(pc)
    db.session.commit()

    # Valid ticket
    ticket = MaintenanceService.create_ticket(
        pc_id=pc.id,
        reporter="kasir",
        kategori="HARDWARE",
        prioritas="SEDANG",
        judul="Keyboard tombol W macet",
        deskripsi="Tolong dicek"
    )
    assert ticket.judul == "Keyboard tombol W macet"
    assert ticket.kategori == "HARDWARE"

    # Invalid kategori / prioritas / judul
    with pytest.raises(ValueError, match="Kategori Tiket"):
        MaintenanceService.create_ticket(pc.id, "kasir", "INVALID_KAT", "SEDANG", "Judul valid")

    with pytest.raises(ValueError, match="Prioritas Tiket"):
        MaintenanceService.create_ticket(pc.id, "kasir", "HARDWARE", "SUPER_HIGH", "Judul valid")

    with pytest.raises(ValueError, match="Judul Tiket"):
        MaintenanceService.create_ticket(pc.id, "kasir", "HARDWARE", "SEDANG", "ab")  # too short (< 3)

    # Invalid status on update
    with pytest.raises(ValueError, match="Status Tiket"):
        MaintenanceService.update_status(ticket.id, "INVALID_STATUS")

    # Invalid biaya range
    with pytest.raises(ValueError, match="Biaya Perbaikan"):
        MaintenanceService.update_status(ticket.id, "SELESAI", resolved_by="teknisi", biaya=-5000)
