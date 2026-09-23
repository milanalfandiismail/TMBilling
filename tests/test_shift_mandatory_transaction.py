# tests/test_shift_mandatory_transaction.py
import pytest
from app import create_app, db
from app.models import User, PC, Paket, Grup, ShiftRecord
from app.services.shift.shift_service import ShiftService

@pytest.fixture
def client_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        grup = Grup(nama="Regular", keterangan="Reguler")
        db.session.add(grup)
        db.session.flush()

        pc = PC(kode="PC-01", nama="PC 01", ip_address="192.168.1.101", grup_id=grup.id)
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id)
        kasir = User(username="kasir_trx", role="kasir")
        kasir.set_password("pass123")
        admin = User(username="admin_trx", role="admin")
        admin.set_password("pass123")
        db.session.add_all([pc, paket, kasir, admin])
        db.session.commit()
        yield app.test_client(), pc, paket, kasir, admin
        db.session.remove()
        db.drop_all()

def test_cashier_without_shift_cannot_transact(client_ctx):
    client, pc, paket, kasir, admin = client_ctx
    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir.id
        sess["kasir_username"] = kasir.username
        sess["kasir_role"] = "kasir"

    # Kasir belum buka shift mencoba buka guest -> HARUS DITOLAK 400
    res = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Pelanggan"})
    assert res.status_code == 400
    assert "buka shift" in res.get_json()["error"].lower()

    # Buka shift
    ShiftService.start_shift(kasir.username, modal_awal=50000, operator=kasir.username)

    # Sekarang coba buka guest lagi -> HARUS SUKSES 201
    res_success = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Pelanggan"})
    assert res_success.status_code == 201

def test_admin_can_transact_without_shift(client_ctx):
    client, pc, paket, kasir, admin = client_ctx
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = "admin"

    # Admin tidak punya shift aktif tapi HARUS BISA transaksi
    res = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Tamu Admin"})
    assert res.status_code == 201
