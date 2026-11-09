from app import create_app, db
from app.models import Grup, PC, Paket, Sesi, User


def test_multi_paket_invalid_does_not_change_first_paket():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-batch-route", "WTF_CSRF_ENABLED": False})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        user = User(username="kasir", nama_lengkap="Kasir", role="admin", aktif=True)
        user.set_password("rahasia123")
        db.session.add_all([grup, user])
        db.session.flush()
        pc = PC(kode="PC-01", nama="PC-01", ip_address="10.0.0.1", grup_id=grup.id, aktif=True)
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=10000, grup_id=grup.id, aktif=True)
        db.session.add_all([pc, paket])
        db.session.flush()
        sesi = Sesi(pc_id=pc.id, tipe="guest", status="aktif", durasi_beli_menit=60)
        db.session.add(sesi)
        db.session.commit()
        client = app.test_client()
        with client.session_transaction() as s:
            s["kasir_id"] = user.id
            s["kasir_username"] = user.username
            s["kasir_role"] = "admin"
        res = client.post(
            f"/api/v1/kasir/sesi/tambah-waktu-sesi/{sesi.id}",
            json={"metode_pembayaran": "Tunai", "selections": [
                {"paket_id": paket.id, "qty": 1},
                {"paket_id": 999999, "qty": 1},
            ]},
        )
        assert res.status_code == 400
        db.session.refresh(sesi)
        assert sesi.durasi_beli_menit == 60
