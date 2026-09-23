# tests/test_paket_menu_validation.py
import pytest
from app import create_app
from app.models import db, Grup, Paket, MenuItem, User
from app.services.paket.paket_service import PaketService
from app.services.menu.menu_service import MenuService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        # Seed grup reguler
        if not Grup.query.filter_by(nama="reguler").first():
            g = Grup(nama="reguler", keterangan="Reguler Zone", warna="#888888")
            db.session.add(g)
            db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def test_create_paket_validation(app_context):
    # Valid normal & max 1 Miliar
    p = PaketService.create({
        "nama": "Paket 3 Jam",
        "durasi_menit": 180,
        "harga": 10000,
        "kadaluarsa_hari": 30,
        "grup": "reguler"
    })
    assert p.nama == "Paket 3 Jam"
    assert p.durasi_menit == 180

    p_max = PaketService.create({
        "nama": "Paket Sultan 1M",
        "durasi_menit": 600,
        "harga": 1_000_000_000,
        "kadaluarsa_hari": 30,
        "grup": "reguler"
    })
    assert p_max.harga == 1_000_000_000

    # Invalid durasi (0 or negative)
    with pytest.raises(ValueError, match="Durasi paket"):
        PaketService.create({"nama": "Paket 0", "durasi_menit": 0, "harga": 5000, "grup": "reguler"})

    # Invalid harga (negative)
    with pytest.raises(ValueError, match="Harga paket"):
        PaketService.create({"nama": "Paket Minus", "durasi_menit": 60, "harga": -1000, "grup": "reguler"})

    # Invalid harga > 1 Miliar
    with pytest.raises(ValueError, match="Harga paket"):
        PaketService.create({"nama": "Paket Over 1M", "durasi_menit": 60, "harga": 1_000_000_001, "grup": "reguler"})


def test_create_menu_validation(app_context):
    # Valid normal & max 1 Miliar
    m = MenuService.create_menu({"nama": "Es Teh Manis", "harga": 3000, "stok": 50})
    assert m.nama == "Es Teh Manis"
    assert m.harga == 3000

    m_max = MenuService.create_menu({"nama": "Steak Wagyu A5", "harga": 1_000_000_000, "stok": 5})
    assert m_max.harga == 1_000_000_000

    # Invalid nama length
    with pytest.raises(ValueError, match="Nama menu minimal 2 karakter"):
        MenuService.create_menu({"nama": "A", "harga": 3000})

    # Invalid negative harga
    with pytest.raises(ValueError, match="Harga menu"):
        MenuService.create_menu({"nama": "Kopi Hitam", "harga": -500})

    # Invalid harga > 1 Miliar
    with pytest.raises(ValueError, match="Harga menu"):
        MenuService.create_menu({"nama": "Kaviar Mewah", "harga": 1_000_000_001})


def test_checkout_menu_order_validation(app_context):
    m = MenuService.create_menu({"nama": "Indomie Goreng", "harga": 6000, "stok": 10})

    # Invalid qty (0 or negative)
    with pytest.raises(ValueError, match="Kuantitas"):
        MenuService.checkout_menu_order(
            cart_items=[{"menu_id": m.id, "jumlah": 0}],
            pc_kode="PC01",
            kasir_username="admin"
        )

    # Invalid qty > 1000
    with pytest.raises(ValueError, match="Kuantitas"):
        MenuService.checkout_menu_order(
            cart_items=[{"menu_id": m.id, "jumlah": 1001}],
            pc_kode="PC01",
            kasir_username="admin"
        )

    # Invalid cash underpayment
    with pytest.raises(ValueError, match="Uang tunai .* kurang dari total tagihan"):
        MenuService.checkout_menu_order(
            cart_items=[{"menu_id": m.id, "jumlah": 2}],  # Total: 12000
            pc_kode="PC01",
            kasir_username="admin",
            tunai=5000,  # Kurang!
            metode_pembayaran="Tunai"
        )
