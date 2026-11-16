from app import create_app, db
from app.models import Transaksi, User


def test_kasir_cannot_read_other_cashier_receipt():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-struk-auth"})
    with app.app_context():
        db.create_all()
        a = User(username="a", nama_lengkap="A", role="kasir", aktif=True)
        b = User(username="b", nama_lengkap="B", role="kasir", aktif=True)
        a.set_password("x"); b.set_password("x")
        db.session.add_all([a, b]); db.session.flush()
        t = Transaksi(jenis="tutup_sesi", no_nota="TM-20260101-001-abcdef", jumlah=1000, user_id=b.id)
        db.session.add(t); db.session.commit()
        client = app.test_client()
        with client.session_transaction() as s:
            s["kasir_id"] = a.id; s["kasir_username"] = "a"; s["kasir_role"] = "kasir"
        res = client.get(f"/api/v1/kasir/report/struk/{t.id}")
        assert res.status_code == 403
