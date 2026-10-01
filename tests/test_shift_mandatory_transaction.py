# tests/test_shift_mandatory_transaction.py
import pytest
from app import create_app, db
from app.models import User, PC, Paket, Grup, Member, ShiftRecord
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
        
        member = Member(username="member_test", nama_lengkap="Member Test", grup_id=grup.id, waktu_tersimpan=120)
        member.set_password("1234")

        db.session.add_all([pc, paket, kasir, admin, member])
        db.session.commit()
        yield app.test_client(), pc, paket, kasir, admin, member
        db.session.remove()
        db.drop_all()

def test_cashier_without_shift_cannot_transact(client_ctx):
    client, pc, paket, kasir, admin, member = client_ctx
    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir.id
        sess["kasir_username"] = kasir.username
        sess["kasir_role"] = "kasir"

    # 1. Kasir belum buka shift mencoba buka guest -> HARUS DITOLAK 400
    res = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Pelanggan"})
    assert res.status_code == 400
    assert "buka shift" in res.get_json()["error"].lower()

    # 2. Kasir belum buka shift mencoba tambah member baru -> HARUS DITOLAK 400
    res_member = client.post("/api/v1/kasir/member/", json={
        "username": "new_user",
        "password": "password123",
        "nama_lengkap": "New User",
        "grup": "Regular"
    })
    assert res_member.status_code == 400
    assert "buka shift" in res_member.get_json()["error"].lower()

    # 3. Kasir belum buka shift mencoba tambah waktu member -> HARUS DITOLAK 400
    res_topup = client.post("/api/v1/kasir/member/tambah-waktu", json={
        "member_id": member.id,
        "paket_id": paket.id,
        "qty": 1,
        "metode_pembayaran": "Tunai"
    })
    assert res_topup.status_code == 400
    assert "buka shift" in res_topup.get_json()["error"].lower()

    # 4. Kasir belum buka shift mencoba edit member -> HARUS DITOLAK 400
    res_edit = client.put(f"/api/v1/kasir/member/{member.id}", json={
        "nama_lengkap": "Updated Name",
        "grup": "Regular"
    })
    assert res_edit.status_code == 400
    assert "buka shift" in res_edit.get_json()["error"].lower()

    # Buka shift kasir
    ShiftService.start_shift(kasir.username, modal_awal=50000, operator=kasir.username)

    # Sekarang coba buka guest lagi -> HARUS SUKSES 201
    res_success = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Pelanggan"})
    assert res_success.status_code == 201

    # Sekarang coba tambah member baru -> HARUS SUKSES 201
    res_member_ok = client.post("/api/v1/kasir/member/", json={
        "username": "new_user",
        "password": "password123",
        "nama_lengkap": "New User",
        "grup": "Regular"
    })
    assert res_member_ok.status_code == 201

    # Sekarang coba tambah saldo/waktu member -> HARUS SUKSES 200
    res_topup_ok = client.post("/api/v1/kasir/member/tambah-waktu", json={
        "member_id": member.id,
        "paket_id": paket.id,
        "qty": 1,
        "metode_pembayaran": "Tunai"
    })
    assert res_topup_ok.status_code == 200

def test_admin_can_transact_without_shift(client_ctx):
    client, pc, paket, kasir, admin, member = client_ctx
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = "admin"

    # Admin tidak punya shift aktif tapi HARUS BISA buka sesi
    res = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Tamu Admin"})
    assert res.status_code == 201

    # Admin tidak punya shift aktif tapi HARUS BISA tambah member
    res_mem = client.post("/api/v1/kasir/member/", json={
        "username": "admin_added_user",
        "password": "password123",
        "nama_lengkap": "Admin Added User",
        "grup": "Regular"
    })
    assert res_mem.status_code == 201

    # Admin tidak punya shift aktif tapi HARUS BISA tambah waktu member
    res_waktu = client.post("/api/v1/kasir/member/tambah-waktu", json={
        "member_id": member.id,
        "paket_id": paket.id,
        "qty": 1,
        "metode_pembayaran": "Tunai"
    })
    assert res_waktu.status_code == 200
