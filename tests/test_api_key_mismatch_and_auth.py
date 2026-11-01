import pytest
from app import create_app, db
from app.models import PC, Grup
from app.services.cache import ApiKeyMismatchStore, OnlineStatusStore, reset_all_cache
from app.services.dashboard.dashboard_service import DashboardService


@pytest.fixture
def auth_test_client():
    reset_all_cache()
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["CLIENT_API_KEY"] = "valid-secret-key-2026"

    with app.app_context():
        grup = Grup.query.filter_by(nama="test_mismatch_grup").first()
        if not grup:
            grup = Grup(nama="test_mismatch_grup", warna="#112233")
            db.session.add(grup)
            db.session.commit()

        pc = PC.query.filter_by(kode="PC-TEST-KEY").first()
        if not pc:
            pc = PC(
                kode="PC-TEST-KEY",
                ip_address="192.168.180.20",
                mac_address="AA:BB:CC:DD:EE:20",
                grup_id=grup.id,
                aktif=True,
            )
            db.session.add(pc)
            db.session.commit()

    with app.test_client() as client:
        yield app, client

    with app.app_context():
        pc = PC.query.filter_by(kode="PC-TEST-KEY").first()
        if pc:
            db.session.delete(pc)
        grup = Grup.query.filter_by(nama="test_mismatch_grup").first()
        if grup:
            db.session.delete(grup)
        db.session.commit()
    reset_all_cache()


def test_member_login_rejects_missing_api_key(auth_test_client):
    app, client = auth_test_client
    # Request tanpa header X-Client-Key harus ditolak 401
    res = client.post(
        "/api/v1/public/auth/login",
        json={"username": "member1", "password": "pass", "ip_address": "192.168.180.20"},
        environ_base={"REMOTE_ADDR": "192.168.180.20"},
    )
    assert res.status_code == 401
    data = res.get_json()
    assert "Akses ditolak" in data.get("error", "")

    # Pastikan tercatat di ApiKeyMismatchStore
    assert ApiKeyMismatchStore.is_mismatch(ip="192.168.180.20") is True


def test_member_login_rejects_invalid_api_key(auth_test_client):
    app, client = auth_test_client
    # Request dengan header X-Client-Key salah harus ditolak 401
    res = client.post(
        "/api/v1/public/auth/login",
        json={"username": "member1", "password": "pass", "ip_address": "192.168.180.20"},
        headers={"X-Client-Key": "wrong-key"},
        environ_base={"REMOTE_ADDR": "192.168.180.20"},
    )
    assert res.status_code == 401

    # ApiKeyMismatchStore harus mencatat mismatch
    assert ApiKeyMismatchStore.is_mismatch(ip="192.168.180.20") is True


def test_member_login_accepts_valid_api_key(auth_test_client):
    app, client = auth_test_client
    # Request dengan API key valid lolos validasi middleware (masuk ke auth service)
    res = client.post(
        "/api/v1/public/auth/login",
        json={"username": "non_existent_member", "password": "pass", "ip_address": "192.168.180.20"},
        headers={"X-Client-Key": "valid-secret-key-2026"},
        environ_base={"REMOTE_ADDR": "192.168.180.20"},
    )
    # Bukan 401 Unauthorized (karena lolos API key, lanjut ke user check -> 400 error user tidak ditemukan)
    assert res.status_code != 401

    # Mismatch harus terhapus/clear jika sebelumnya ada
    assert ApiKeyMismatchStore.is_mismatch(ip="192.168.180.20") is False


def test_monitor_route_requires_api_key(auth_test_client):
    app, client = auth_test_client
    # /api/v1/public/monitor tanpa key -> 401
    res = client.post(
        "/api/v1/public/monitor",
        json={"CpuUsage": 10.0},
        environ_base={"REMOTE_ADDR": "192.168.180.20"},
    )
    assert res.status_code == 401

    # Dengan key salah -> 401
    res_wrong = client.post(
        "/api/v1/public/monitor",
        json={"CpuUsage": 10.0},
        headers={"X-Client-Key": "wrong-key"},
        environ_base={"REMOTE_ADDR": "192.168.180.20"},
    )
    assert res_wrong.status_code == 401


def test_dashboard_card_reflects_api_key_mismatch(auth_test_client):
    app, client = auth_test_client
    with app.app_context():
        pc = PC.query.filter_by(kode="PC-TEST-KEY").first()
        assert pc is not None

        # 1. Simulasikan PC online sebelumnya
        OnlineStatusStore.mark_active(pc.id)
        data_normal = DashboardService.get_pc_list()
        pc_normal = next(p for p in data_normal["pc_list"] if p["id"] == pc.id)
        assert pc_normal["online"] is True
        assert pc_normal["status_koneksi"] == "online"
        assert pc_normal.get("api_key_mismatch") is False

        # 2. Sekarang simulasikan request masuk dengan API key salah
        client.post(
            "/api/v1/public/client/status",
            json={"ip_address": pc.ip_address, "mac_address": pc.mac_address},
            headers={"X-Client-Key": "invalid-key"},
            environ_base={"REMOTE_ADDR": pc.ip_address},
        )

        # 3. Cek kembali dashboard: PC tidak boleh nyala (online=False) dan status_koneksi='api_key_mismatch'
        data_mismatch = DashboardService.get_pc_list()
        pc_mismatch = next(p for p in data_mismatch["pc_list"] if p["id"] == pc.id)
        assert pc_mismatch["online"] is False
        assert pc_mismatch["status_koneksi"] == "api_key_mismatch"
        assert pc_mismatch["api_key_mismatch"] is True

        # 4. Simulasikan client diperbaiki API key-nya dan mengirim request valid
        client.post(
            "/api/v1/public/client/status",
            json={"ip_address": pc.ip_address, "mac_address": pc.mac_address},
            headers={"X-Client-Key": "valid-secret-key-2026"},
            environ_base={"REMOTE_ADDR": pc.ip_address},
        )

        # 5. Mismatch sudah ter-clear, PC kembali online normal
        OnlineStatusStore.mark_active(pc.id)
        data_recovered = DashboardService.get_pc_list()
        pc_recovered = next(p for p in data_recovered["pc_list"] if p["id"] == pc.id)
        assert pc_recovered["online"] is True
        assert pc_recovered["status_koneksi"] == "online"
        assert pc_recovered["api_key_mismatch"] is False
