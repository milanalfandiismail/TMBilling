import pytest
from app import create_app, db
from app.models import User, ShiftRecord


@pytest.fixture
def ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        admin = User(username="admin_shift", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        kasir = User(username="kasir_shift", nama_lengkap="Kasir", role="kasir")
        kasir.set_password("pass123")
        db.session.add_all([admin, kasir])
        db.session.commit()

        shift_lain = ShiftRecord(kasir_id=kasir.id, modal_awal=0, status="SELESAI")
        db.session.add(shift_lain)
        db.session.commit()
        yield app, admin, kasir, shift_lain
        db.session.remove()


def _login(client, user):
    with client.session_transaction() as sess:
        sess["kasir_id"] = user.id
        sess["kasir_username"] = user.username
        sess["kasir_role"] = user.role


def test_kasir_tidak_boleh_baca_shift_id_eksplisit(ctx):
    app, _, kasir, shift = ctx
    client = app.test_client()
    _login(client, kasir)

    resp = client.get(f"/api/v1/kasir/shift/{shift.id}/summary")

    assert resp.status_code == 403
    assert "Akses ditolak" in resp.get_json()["error"]


def test_admin_boleh_baca_shift_id_eksplisit(ctx):
    app, admin, _, shift = ctx
    client = app.test_client()
    _login(client, admin)

    resp = client.get(f"/api/v1/kasir/shift/{shift.id}/summary")

    assert resp.status_code == 200
    assert "summary" in resp.get_json()


def test_kasir_tanpa_id_tidak_boleh_melihat_ringkasan_shift_aktif(ctx):
    app, _, kasir, _ = ctx
    from app.models import Transaksi
    from datetime import datetime

    aktif = ShiftRecord(kasir_id=kasir.id, modal_awal=0, status="AKTIF",
                        waktu_mulai=datetime(2026, 1, 1, 8, 0, 0))
    db.session.add(aktif)
    db.session.commit()
    db.session.add(Transaksi(jenis="beli_paket", jumlah=12345,
                             metode_pembayaran="Tunai", user_id=kasir.id,
                             dibuat_pada=datetime(2026, 1, 1, 9, 0, 0)))
    db.session.commit()

    client = app.test_client()
    _login(client, kasir)

    resp = client.get("/api/v1/kasir/shift/summary")

    assert resp.status_code == 403
    assert "total_billing" not in resp.get_json()
