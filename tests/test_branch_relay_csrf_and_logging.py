# tests/test_branch_relay_csrf_and_logging.py
"""Test suite untuk perbaikan CSRF relay, audit logging cerdas (MAC address), dan keamanan role admin."""

import pytest
from flask import session
from app import create_app
from app.models import db, User, PC, Paket, Grup, Sesi
from app.services.settings.settings_service import SettingsService
from app.services.transaksi.transaksi_service import TransaksiService
from app.services.branch.branch_proxy_service import BranchProxyService
from app.models.branch import Branch


@pytest.fixture
def app_and_client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = True  # Aktifkan CSRF untuk membuktikan relay kebal terhadap CSRF
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with app.app_context():
        db.create_all()

        # Pastikan ada Admin lokal
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", role="admin", aktif=True)
            admin.set_password("admin123")
            db.session.add(admin)

        # Buat Grup PC
        grup = Grup.query.filter_by(nama="reguler").first()
        if not grup:
            grup = Grup(nama="reguler")
            db.session.add(grup)
            db.session.flush()

        # Buat PC
        pc1 = PC(kode="PC-01", nama="PC 1", grup_id=grup.id, ip_address="192.168.1.101")
        pc2 = PC(kode="PC-02", nama="PC 2", grup_id=grup.id, ip_address="192.168.1.102")
        db.session.add_all([pc1, pc2])

        # Buat Paket
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
        db.session.add(paket)

        # Set title warnet lokal
        SettingsService.set("warnet_title", "TM-Esports Pusat")

        db.session.commit()

        client = app.test_client()
        yield app, client

        db.session.remove()
        db.drop_all()


def test_relay_csrf_exemption_and_diff_name_logging(app_and_client):
    """Memastikan request mutasi POST via Bearer Token tidak terkena CSRF 400,

    dan mencatat operator 'username (Remote: NamaCabang)' ketika nama warnet berbeda.
    """
    app, client = app_and_client
    with app.app_context():
        local_key = SettingsService.get_or_create_branch_api_key()
        paket = Paket.query.first()
        paket_id = paket.id

    # Kirim request POST buka guest TANPA header CSRF (seperti layaknya relay server-to-server)
    headers = {
        "Authorization": f"Bearer {local_key}",
        "X-Operator-Username": "kasir_andi",
        "X-Origin-Branch-Name": "TM-Esports Selatan",
        "X-Origin-MAC": "00:11:22:33:44:55",
        "Content-Type": "application/json"
    }
    payload = {
        "pc_kode": "PC-01",
        "nama_guest": "Pelanggan 1",
        "paket_id": paket_id,
        "metode_pembayaran": "tunai"
    }

    res = client.post("/api/v1/kasir/sesi/buka-guest", headers=headers, json=payload)
    # Harus sukses, bukan 400 Bad Request (The CSRF token is missing)
    assert res.status_code in (200, 201), f"Expected 200/201 but got {res.status_code}: {res.get_data(as_text=True)}"

    import json
    from app.utils.logger import read_logs
    logs = read_logs(limit=10)
    guest_log = next(json.loads(line) for line in logs if "PC-01" in line and "BUKA_GUEST" in line)
    # Karena nama 'TM-Esports Selatan' berbeda dari lokal 'TM-Esports Pusat', tidak perlu tag MAC
    assert guest_log["user"] == "kasir_andi (Remote: TM-Esports Selatan)"


def test_relay_same_name_logging_with_mac(app_and_client):
    """Memastikan jika nama warnet pengirim SAMA dengan nama warnet penerima,
    tag [MAC: ...] otomatis disematkan untuk menjamin tidak tertukar.
    """
    app, client = app_and_client
    with app.app_context():
        local_key = SettingsService.get_or_create_branch_api_key()
        paket = Paket.query.first()

    # Kirim request dengan nama warnet SAMA dengan lokal ('TM-Esports Pusat')
    headers = {
        "Authorization": f"Bearer {local_key}",
        "X-Operator-Username": "tmadmin",
        "X-Origin-Branch-Name": "TM-Esports Pusat",
        "X-Origin-MAC": "AA:BB:CC:DD:EE:FF",
        "Content-Type": "application/json"
    }
    payload = {
        "pc_kode": "PC-02",
        "nama_guest": "Pelanggan 2",
        "paket_id": paket.id,
        "metode_pembayaran": "tunai"
    }

    res = client.post("/api/v1/kasir/sesi/buka-guest", headers=headers, json=payload)
    assert res.status_code in (200, 201), f"Expected 200/201 but got {res.status_code}: {res.get_data(as_text=True)}"

    import json
    from app.utils.logger import read_logs
    logs = read_logs(limit=10)
    guest_log = next(json.loads(line) for line in logs if "PC-02" in line and "BUKA_GUEST" in line)
    # Karena nama sama persis, otomatis disambiguasi dengan MAC address fisik
    assert guest_log["user"] == "tmadmin (Remote: TM-Esports Pusat [MAC: AA:BB:CC:DD:EE:FF])"


def test_transaksi_service_resolves_base_operator(app_and_client):
    """Memastikan TransaksiService.get_user_id() mengekstrak username dasar
    sehingga user_id transaksi tidak bernilai None/FK constraint error.
    """
    app, _ = app_and_client
    with app.app_context():
        admin = User.query.filter_by(username="admin").first()
        assert admin is not None

        # Operator remote tanpa MAC
        uid1 = TransaksiService.get_user_id("admin (Remote: Cabang Selatan)")
        assert uid1 == admin.id

        # Operator remote dengan MAC
        uid2 = TransaksiService.get_user_id("admin (Remote: TM-Esports Pusat [MAC: AA:BB:CC:DD:EE:FF])")
        assert uid2 == admin.id

        # Operator lokal biasa
        uid3 = TransaksiService.get_user_id("admin")
        assert uid3 == admin.id


def test_backend_relay_kasir_role_guard(app_and_client):
    """Memastikan BranchProxyService.relay_request menolak request
    jika user di session memiliki role 'kasir' (403 Forbidden).
    """
    app, client = app_and_client
    with app.app_context():
        branch = Branch(nama="Cabang Remote", url="http://127.0.0.1:9999", api_key="testkey", aktif=True)
        db.session.add(branch)
        db.session.commit()
        branch_id = branch.id

        # Skenario 1: Kasir mencoba relay request
        with app.test_request_context("/api/v1/kasir/sesi/buka-guest", headers={"X-Branch-ID": str(branch_id)}):
            session["kasir_role"] = "kasir"
            session["kasir_username"] = "kasir1"
            from flask import request
            resp = BranchProxyService.relay_request(branch_id, request)
            status_code = resp[1] if isinstance(resp, tuple) else resp.status_code
            assert status_code == 403

        # Skenario 2: Admin diizinkan (lanjut ke network call)
        with app.test_request_context("/api/v1/kasir/sesi/buka-guest", headers={"X-Branch-ID": str(branch_id)}):
            session["kasir_role"] = "admin"
            session["kasir_username"] = "admin"
            from flask import request
            resp = BranchProxyService.relay_request(branch_id, request)
            status_code = resp[1] if isinstance(resp, tuple) else resp.status_code
            # Karena port 9999 offline, response status adalah 503 (offline) bukan 403 (dilarang)
            assert status_code == 503


def test_relay_logging_never_uses_literal_cabang(app_and_client):
    """Memastikan bahwa header 'Cabang' atau tanpa header tidak pernah menghasilkan
    'admin (Remote: Cabang)', melainkan menggunakan nama cabang terdaftar atau nama warnet asli.
    """
    app, client = app_and_client
    with app.app_context():
        local_key = SettingsService.get_or_create_branch_api_key()
        paket = Paket.query.first()
        paket_id = paket.id

        # Daftarkan cabang Milan Net dengan IP 180.247.246.49
        b = Branch(nama="Milan Net", url="http://180.247.246.49:5000", api_key="remote_key", aktif=True)
        db.session.add(b)
        db.session.commit()

    import json
    from app.utils.logger import read_logs

    # Kasus 1: Request datang dari IP 180.247.246.49 dengan header 'Cabang' (legacy/placeholder)
    headers = {
        "Authorization": f"Bearer {local_key}",
        "X-Operator-Username": "admin",
        "X-Origin-Branch-Name": "Cabang",
        "X-Forwarded-For": "180.247.246.49",
        "Content-Type": "application/json"
    }
    payload = {
        "pc_kode": "PC-01",
        "nama_guest": "Pelanggan Cabang Test",
        "paket_id": paket_id,
        "metode_pembayaran": "tunai"
    }
    res = client.post("/api/v1/kasir/sesi/buka-guest", headers=headers, json=payload)
    assert res.status_code in (200, 201)

    logs = read_logs(limit=5)
    log_entry = next(json.loads(line) for line in logs if "Pelanggan Cabang Test" in line)
    # Harus mendeteksi 'Milan Net' dari IP, BUKAN 'Cabang'
    assert "Cabang" not in log_entry["user"]
    assert log_entry["user"] == "admin (Remote: Milan Net)"

    # Kasus 2: Request dari IP antah berantah tanpa nama cabang
    headers2 = {
        "Authorization": f"Bearer {local_key}",
        "X-Operator-Username": "admin",
        "X-Origin-Branch-Name": "",
        "X-Forwarded-For": "10.0.0.99",
        "Content-Type": "application/json"
    }
    payload2 = {
        "pc_kode": "PC-02",
        "nama_guest": "Pelanggan Generic Test",
        "paket_id": paket_id,
        "metode_pembayaran": "tunai"
    }
    res2 = client.post("/api/v1/kasir/sesi/buka-guest", headers=headers2, json=payload2)
    assert res2.status_code in (200, 201)

    logs2 = read_logs(limit=5)
    log_entry2 = next(json.loads(line) for line in logs2 if "Pelanggan Generic Test" in line)
    # Harus fallback ke 'TMBilling', BUKAN 'Cabang' atau 'Remote'
    assert "Cabang" not in log_entry2["user"]
    assert log_entry2["user"] == "admin (Remote: TMBilling)"


def test_branch_proxy_service_relay_headers_uses_warnet_title_not_cabang(app_and_client):
    """Memastikan bahwa saat merelay request, header X-Origin-Branch-Name
    berisi nama warnet asli atau default TMBilling, dan tidak pernah 'Cabang'.
    """
    from unittest.mock import patch, MagicMock
    app, client = app_and_client

    with app.app_context():
        b = Branch(nama="Target Branch", url="http://192.168.1.50:5000", api_key="secret", aktif=True)
        db.session.add(b)
        db.session.commit()
        branch_id = b.id

        # Kasus A: warnet_title diatur ke 'Milan Net'
        SettingsService.set("warnet_title", "Milan Net")

        with patch("requests.request") as mock_req:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.content = b'{"success": true}'
            mock_resp.headers = {"Content-Type": "application/json"}
            mock_req.return_value = mock_resp

            with app.test_request_context("/api/v1/kasir/sesi/buka-guest", method="POST"):
                session["kasir_role"] = "admin"
                session["kasir_username"] = "admin"
                from flask import request
                resp = BranchProxyService.relay_request(branch_id, request)

                call_headers = mock_req.call_args[1]["headers"]
                assert call_headers["X-Origin-Branch-Name"] == "Milan Net"
                assert "Cabang" not in call_headers["X-Origin-Branch-Name"]

        # Kasus B: warnet_title kosong / None
        SettingsService.set("warnet_title", "")

        with patch("requests.request") as mock_req:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.content = b'{"success": true}'
            mock_resp.headers = {"Content-Type": "application/json"}
            mock_req.return_value = mock_resp

            with app.test_request_context("/api/v1/kasir/sesi/buka-guest", method="POST"):
                session["kasir_role"] = "admin"
                session["kasir_username"] = "admin"
                from flask import request
                resp = BranchProxyService.relay_request(branch_id, request)

                call_headers = mock_req.call_args[1]["headers"]
                assert call_headers["X-Origin-Branch-Name"] == "TMBilling"
                assert "Cabang" not in call_headers["X-Origin-Branch-Name"]


