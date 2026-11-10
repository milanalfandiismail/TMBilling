import pytest
from app import create_app, db
from app.models import User, ShiftRecord, Transaksi
from app.services.user.user_service import UserService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app


def test_user_dengan_shift_tidak_bisa_dihapus(ctx):
    user = User(username="kasir_shift", nama_lengkap="Kasir", role="kasir")
    user.set_password("pass123")
    db.session.add(user)
    db.session.commit()
    db.session.add(ShiftRecord(kasir_id=user.id, modal_awal=0, status="SELESAI"))
    db.session.commit()

    with pytest.raises(ValueError, match="Nonaktifkan saja"):
        UserService.delete_user(user.id)

    assert db.session.get(User, user.id) is not None


def test_user_dengan_transaksi_tidak_bisa_dihapus(ctx):
    user = User(username="kasir_trx", nama_lengkap="Kasir", role="kasir")
    user.set_password("pass123")
    db.session.add(user)
    db.session.commit()
    db.session.add(Transaksi(no_nota="TM-20260101-001", jenis="tutup_sesi",
                             jumlah=10000, menit=60, user_id=user.id))
    db.session.commit()

    with pytest.raises(ValueError, match="Nonaktifkan saja"):
        UserService.delete_user(user.id)

    assert db.session.get(User, user.id) is not None
