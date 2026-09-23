import pytest
from app import create_app, db
from app.models import User, PC, Paket, Grup
from app.services.settings.settings_service import SettingsService


@pytest.fixture
def relay_app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.app_context():
        db.create_all()

        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", role="admin", aktif=True)
            admin.set_password("admin123")
            db.session.add(admin)

        grup = Grup.query.filter_by(nama="reguler").first()
        if not grup:
            grup = Grup(nama="reguler")
            db.session.add(grup)
            db.session.flush()

        pc = PC(kode="PC-01", nama="PC 1", grup_id=grup.id, ip_address="192.168.1.101")
        db.session.add(pc)

        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
        db.session.add(paket)

        SettingsService.set("warnet_title", "TM-Pusat")
        db.session.commit()

        yield app

        db.session.remove()
        db.drop_all()


def test_bearer_relay_does_not_emit_session_cookie(relay_app):
    client = relay_app.test_client()

    with relay_app.app_context():
        local_key = SettingsService.get_or_create_branch_api_key()
        paket = Paket.query.first()
        paket_id = paket.id

    headers = {
        "Authorization": f"Bearer {local_key}",
        "X-Operator-Username": "remote_kasir",
        "X-Origin-Branch-Name": "TM-Cabang-A",
        "Content-Type": "application/json",
    }
    payload = {
        "pc_kode": "PC-01",
        "nama_guest": "Pelanggan Remote",
        "paket_id": paket_id,
        "metode_pembayaran": "tunai",
    }

    # Kirim request dengan Bearer token
    response = client.post("/api/v1/kasir/sesi/buka-guest", headers=headers, json=payload)
    assert response.status_code in [200, 201]

    # Verifikasi bahwa TIDAK ADA cookie 'session' yang diset di response header
    set_cookie_headers = response.headers.getlist("Set-Cookie")
    session_cookies = [h for h in set_cookie_headers if "session=" in h]
    assert len(session_cookies) == 0, f"Ditemukan session cookie bocor pada request stateless: {session_cookies}"


def test_login_and_admin_required_accepts_g_context(relay_app):
    client = relay_app.test_client()

    with relay_app.app_context():
        local_key = SettingsService.get_or_create_branch_api_key()

    headers = {
        "Authorization": f"Bearer {local_key}",
        "X-Operator-Username": "admin_remote",
        "X-Origin-Branch-Name": "TM-Cabang-B",
    }

    # Endpoint admin required (contoh: get backup / settings status)
    response = client.get("/api/v1/kasir/settings/", headers=headers)
    assert response.status_code == 200
    data = response.get_json()
    assert "success" in data or "settings" in data
