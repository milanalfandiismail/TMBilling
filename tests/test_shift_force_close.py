# tests/test_shift_force_close.py
import pytest
from app import create_app, db
from app.models import User, ShiftRecord
from app.services.shift.shift_service import ShiftService

@pytest.fixture
def force_close_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_fc", nama_lengkap="Kasir Terkunci", role="kasir")
        kasir.set_password("pass123")
        kasir2 = User(username="kasir_next", nama_lengkap="Kasir Berikutnya", role="kasir")
        kasir2.set_password("pass123")
        admin = User(username="admin_fc", nama_lengkap="Admin Utama", role="admin")
        admin.set_password("pass123")
        db.session.add_all([kasir, kasir2, admin])
        db.session.commit()
        yield app.test_client(), kasir, kasir2, admin
        db.session.remove()
        db.drop_all()

def test_admin_force_close_shift(force_close_ctx):
    client, kasir, kasir2, admin = force_close_ctx
    shift = ShiftService.start_shift("kasir_fc", modal_awal=50000, operator="kasir_fc")

    # Kasir biasa tidak boleh force-close
    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir.id
        sess["kasir_username"] = kasir.username
        sess["kasir_role"] = "kasir"

    res_fail = client.post("/api/v1/kasir/shift/force-close", json={"shift_id": shift.id, "alasan": "Tutup"})
    assert res_fail.status_code == 403

    # Admin force close
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = "admin"

    # Alasan opsional / kosong -> 200
    res_ok = client.post("/api/v1/kasir/shift/force-close", json={"shift_id": shift.id, "alasan": ""})
    assert res_ok.status_code == 200
    assert res_ok.get_json()["success"] is True

    # Shift sekarang harus SELESAI
    saved = ShiftRecord.query.get(shift.id)
    assert saved.status == "SELESAI"
    assert "FORCE CLOSE oleh admin_fc" in saved.catatan

    # Kasir berikutnya sekarang BISA buka shift baru
    shift2 = ShiftService.start_shift("kasir_next", modal_awal=50000, operator="kasir_next")
    assert shift2.status == "AKTIF"

    # Force close shift2 dengan custom alasan
    res_custom = client.post("/api/v1/kasir/shift/force-close", json={"shift_id": shift2.id, "alasan": "Kasir pulang darurat karena sakit"})
    assert res_custom.status_code == 200
    saved2 = ShiftRecord.query.get(shift2.id)
    assert saved2.status == "SELESAI"
    assert "Kasir pulang darurat" in saved2.catatan
