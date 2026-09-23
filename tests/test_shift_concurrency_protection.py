# tests/test_shift_concurrency_protection.py
import pytest
from app import create_app, db
from app.models import User, ShiftRecord
from app.services.shift.shift_service import ShiftService
from app.services.auth.auth_kasir_service import AuthKasirService

@pytest.fixture
def concurrency_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir1 = User(username="kasir1", nama_lengkap="Kasir Pertama", role="kasir")
        kasir1.set_password("pass123")
        kasir2 = User(username="kasir2", nama_lengkap="Kasir Kedua", role="kasir")
        kasir2.set_password("pass123")
        admin = User(username="admin_bos", nama_lengkap="Bos Warnet", role="admin")
        admin.set_password("pass123")
        db.session.add_all([kasir1, kasir2, admin])
        db.session.commit()
        yield app, kasir1, kasir2, admin
        db.session.remove()
        db.drop_all()

def test_single_active_shift_system_wide(concurrency_ctx):
    app, kasir1, kasir2, admin = concurrency_ctx
    # Kasir 1 buka shift
    ShiftService.start_shift("kasir1", modal_awal=50000, operator="kasir1")

    # Kasir 2 mencoba buka shift saat Kasir 1 masih aktif -> HARUS GAGAL
    with pytest.raises(ValueError, match="Masih ada shift aktif"):
        ShiftService.start_shift("kasir2", modal_awal=50000, operator="kasir2")

def test_cashier_login_concurrency_restriction(concurrency_ctx):
    app, kasir1, kasir2, admin = concurrency_ctx
    # Kasir 1 buka shift
    ShiftService.start_shift("kasir1", modal_awal=50000, operator="kasir1")

    # 1. Kasir 1 (pemegang shift aktif) login ulang -> HARUS SUKSES (tanpa batas waktu)
    res_k1 = AuthKasirService.login("kasir1", "pass123")
    assert res_k1["success"] is True

    # 2. Kasir 2 mencoba login saat shift Kasir 1 aktif -> HARUS DITOLAK
    with pytest.raises(PermissionError, match="Shift kasir saat ini sedang aktif oleh 'Kasir Pertama'"):
        AuthKasirService.login("kasir2", "pass123")

    # 3. Admin login saat shift Kasir 1 aktif -> HARUS SUKSES
    res_adm = AuthKasirService.login("admin_bos", "pass123")
    assert res_adm["success"] is True

def test_login_route_permission_error_returns_403(concurrency_ctx):
    app, kasir1, kasir2, admin = concurrency_ctx
    ShiftService.start_shift("kasir1", modal_awal=50000, operator="kasir1")

    client = app.test_client()
    resp = client.post("/api/v1/kasir/auth/login", json={"username": "kasir2", "password": "pass123"})
    assert resp.status_code == 403
    data = resp.get_json()
    assert "Akses Ditolak" in data["error"]
