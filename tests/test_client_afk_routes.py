# tests/test_client_afk_routes.py
import pytest
from app import create_app, db
from app.models import PC, Sesi, Member, Grup, now_local

@pytest.fixture
def client_app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["CLIENT_API_KEY"] = "test-key-123"
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC01", nama="PC 01", ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()

def test_guest_afk_lock_and_unlock(client_app):
    with client_app.test_client() as c:
        with client_app.app_context():
            pc = PC.query.filter_by(kode="PC01").first()
            pc_id = pc.id
            sesi = Sesi(tipe="guest", pc_id=pc_id, nama_guest="Budi", durasi_beli_menit=60, status="aktif")
            db.session.add(sesi)
            db.session.commit()

        headers = {"X-Client-Key": "test-key-123"}

        # 1. Kunci Meja dengan PIN 1234
        res = c.post("/api/v1/public/client/afk-lock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "pin": "1234"}, headers=headers)
        assert res.status_code == 200
        assert res.get_json()["success"] is True

        with client_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()
            assert saved_sesi.is_afk is True

        # 2. Polling status memuat is_afk
        res_poll = c.post("/api/v1/public/client/status", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01"}, headers=headers)
        assert res_poll.status_code == 200
        assert res_poll.get_json()["is_afk"] is True

        # 3. Unlock dengan PIN salah
        res_wrong = c.post("/api/v1/public/client/afk-unlock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "credential": "9999"}, headers=headers)
        assert res_wrong.status_code == 401

        # 4. Unlock dengan PIN benar
        res_ok = c.post("/api/v1/public/client/afk-unlock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "credential": "1234"}, headers=headers)
        assert res_ok.status_code == 200
        assert res_ok.get_json()["success"] is True

        with client_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()
            assert saved_sesi.is_afk is False

def test_member_afk_lock_and_unlock_with_password(client_app):
    with client_app.test_client() as c:
        with client_app.app_context():
            pc = PC.query.filter_by(kode="PC01").first()
            pc_id = pc.id
            grup = Grup.query.filter_by(nama="reguler").first()
            member = Member(username="gamer123", nama_lengkap="Pro Gamer", grup_id=grup.id, waktu_tersimpan=120, aktif=True)
            member.set_password("rahasia123")
            db.session.add(member)
            db.session.commit()

            sesi = Sesi(tipe="member", pc_id=pc_id, member_id=member.id, status="aktif")
            db.session.add(sesi)
            db.session.commit()

        headers = {"X-Client-Key": "test-key-123"}

        # 1. Member langsung lock tanpa PIN
        res = c.post("/api/v1/public/client/afk-lock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01"}, headers=headers)
        assert res.status_code == 200
        assert res.get_json()["success"] is True

        with client_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()
            assert saved_sesi.is_afk is True

        # 2. Member unlock dengan password salah
        res_wrong = c.post("/api/v1/public/client/afk-unlock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "credential": "passwordsalah"}, headers=headers)
        assert res_wrong.status_code == 401

        # 3. Member unlock dengan password benar
        res_ok = c.post("/api/v1/public/client/afk-unlock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "credential": "rahasia123"}, headers=headers)
        assert res_ok.status_code == 200
        assert res_ok.get_json()["success"] is True

        with client_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()
            assert saved_sesi.is_afk is False
