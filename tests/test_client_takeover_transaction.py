from app import create_app, db
from app.models import Grup, PC, Sesi, Transaksi, User
from app.services.client.client_service import ClientService


def test_admin_login_closes_guest_session_with_transaction():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-takeover"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        admin = User(username="adminx", nama_lengkap="Admin", role="admin", aktif=True)
        admin.set_password("rahasia123")
        db.session.add_all([grup, admin])
        db.session.flush()
        pc = PC(kode="PC-01", nama="PC-01", ip_address="10.0.0.1",
                mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.flush()
        sesi = Sesi(pc_id=pc.id, tipe="guest", status="aktif", durasi_beli_menit=60)
        db.session.add(sesi)
        db.session.commit()

        ClientService.admin_login("10.0.0.1", "AA:BB:CC:DD:EE:01", "adminx", "rahasia123")

        db.session.refresh(sesi)
        assert sesi.status == "selesai"
        assert Transaksi.query.filter_by(sesi_id=sesi.id, jenis="tutup_sesi").count() == 1
