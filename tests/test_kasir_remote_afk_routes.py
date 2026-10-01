# tests/test_kasir_remote_afk_routes.py
import pytest
from app import create_app, db
from app.models import PC, Sesi, User, Grup, ShiftRecord, now_local
from app.services.client.client_service import PENDING_COMMANDS

@pytest.fixture
def kasir_app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["WTF_CSRF_ENABLED"] = False
    with app.app_context():
        db.create_all()
        admin = User.query.filter_by(role="admin").first()
        if not admin:
            admin = User(username="admin", role="admin", aktif=True)
            admin.set_password("admin123")
            db.session.add(admin)
            db.session.commit()

        grup = Grup.query.filter_by(nama="reguler").first()
        if not grup:
            grup = Grup(nama="reguler", warna="#888888")
            db.session.add(grup)
            db.session.commit()

        shift = ShiftRecord(kasir_id=admin.id, modal_awal=50000, status="AKTIF", waktu_mulai=now_local())
        db.session.add(shift)
        pc = PC(kode="PC02", nama="PC 02", ip_address="192.168.1.102", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()

        sesi = Sesi(tipe="guest", pc_id=pc.id, nama_guest="Doni", durasi_beli_menit=60, status="aktif")
        db.session.add(sesi)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()

def test_kasir_remote_afk_lock_and_master_unlock(kasir_app):
    from app.services import ClientService

    with kasir_app.test_client() as c:
        with kasir_app.app_context():
            admin = User.query.filter_by(role="admin").first()
            admin_id = admin.id
            shift = ShiftRecord.query.first()
            shift_id = shift.id
            pc = PC.query.filter_by(kode="PC02").first()
            pc_id = pc.id

        with c.session_transaction() as sess:
            sess["kasir_id"] = admin_id
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
            sess["shift_id"] = shift_id

        # 1. Kasir Remote Kunci Meja tanpa PIN -> Ditolak (400)
        res_no_pin = c.post(f"/api/v1/kasir/monitor/remote/{pc_id}/afk-lock", json={})
        assert res_no_pin.status_code == 400

        # 2. Kasir Remote Kunci Meja dengan PIN valid 5678 -> Sukses (200)
        res_lock = c.post(f"/api/v1/kasir/monitor/remote/{pc_id}/afk-lock", json={"pin": "5678"})
        assert res_lock.status_code == 200
        assert res_lock.get_json()["success"] is True
        assert PENDING_COMMANDS.get(pc_id) == "afk_lock"

        with kasir_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()
            assert saved_sesi.is_afk is True
            assert saved_sesi.afk_pin is not None

        # 3. Client mencoba buka kunci dengan sembarang huruf -> Ditolak (PermissionError)
        with kasir_app.app_context():
            with pytest.raises(PermissionError):
                ClientService.afk_unlock(ip_address="192.168.1.102", mac_address=None, credential="asdfg")

        # 4. Client mencoba buka kunci dengan PIN salah -> Ditolak
        with kasir_app.app_context():
            with pytest.raises(PermissionError):
                ClientService.afk_unlock(ip_address="192.168.1.102", mac_address=None, credential="9999")

        # 5. Kasir Remote Master Unlock -> Sukses (200)
        res_unlock = c.post(f"/api/v1/kasir/monitor/remote/{pc_id}/afk-unlock")
        assert res_unlock.status_code == 200
        assert res_unlock.get_json()["success"] is True
        assert PENDING_COMMANDS.get(pc_id) == "afk_unlock"

        with kasir_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()
            assert saved_sesi.is_afk is False
            assert saved_sesi.afk_pin is None
