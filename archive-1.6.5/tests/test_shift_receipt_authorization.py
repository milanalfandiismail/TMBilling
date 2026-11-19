import pytest

from app import create_app, db
from app.models import ShiftRecord, User


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SECRET_KEY": "test-shift-receipt",
    })
    with app.app_context():
        db.create_all()
        pemilik = User(username="pemilik", nama_lengkap="Pemilik", role="kasir", aktif=True)
        pemilik.set_password("rahasia")
        kasir = User(username="kasir_lain", nama_lengkap="Kasir Lain", role="kasir", aktif=True)
        kasir.set_password("rahasia")
        admin = User.query.filter_by(username="admin").first()
        admin.nama_lengkap = "Admin"
        admin.role = "admin"
        admin.aktif = True
        db.session.add_all([pemilik, kasir])
        db.session.flush()
        shift = ShiftRecord(kasir_id=pemilik.id, modal_awal=0, status="AKTIF")
        db.session.add(shift)
        db.session.commit()

        kasir_client = app.test_client()
        with kasir_client.session_transaction() as sess:
            sess["kasir_id"] = kasir.id
            sess["kasir_username"] = kasir.username
            sess["kasir_role"] = "kasir"
        admin_client = app.test_client()
        with admin_client.session_transaction() as sess:
            sess["kasir_id"] = admin.id
            sess["kasir_username"] = admin.username
            sess["kasir_role"] = "admin"
        yield kasir_client, admin_client, shift
        db.session.remove()
        db.drop_all()


def test_kasir_tidak_bisa_baca_struk_shift_lain(app_ctx):
    kasir_client, admin_client, shift_orang_lain = app_ctx
    res = kasir_client.get(f"/api/v1/kasir/shift/receipt/{shift_orang_lain.id}")
    assert res.status_code == 403


def test_admin_bisa_baca_struk_shift_kasir(app_ctx):
    kasir_client, admin_client, shift_orang_lain = app_ctx
    res = admin_client.get(f"/api/v1/kasir/shift/receipt/{shift_orang_lain.id}")
    assert res.status_code == 200
    assert "receipt_text" in res.get_json()
