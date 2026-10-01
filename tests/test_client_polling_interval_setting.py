import pytest
from app import create_app, db
from app.models import PC, Sesi, User, Grup, Settings
from app.services import SettingsService, ClientService, SesiService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["WTF_CSRF_ENABLED"] = False
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app_context):
    return app_context.test_client()


def test_client_polling_interval_defaults_and_presets(app_context):
    # Default harus 5 detik jika belum diset
    assert SettingsService.get_client_polling_interval() == 5

    # Simpan nilai valid: 1, 5, 10
    SettingsService.set_client_polling_interval(1)
    assert SettingsService.get_client_polling_interval() == 1

    SettingsService.set_client_polling_interval(10)
    assert SettingsService.get_client_polling_interval() == 10

    SettingsService.set_client_polling_interval(5)
    assert SettingsService.get_client_polling_interval() == 5

    # Nilai di luar 1, 5, 10 harus raise ValueError
    with pytest.raises(ValueError):
        SettingsService.set_client_polling_interval(60)

    with pytest.raises(ValueError):
        SettingsService.set_client_polling_interval(0)


def test_client_polling_interval_routes_validation(client, app_context):
    admin = User(username="admin_poll", role="admin", aktif=True)
    admin.set_password("admin123")
    db.session.add(admin)
    db.session.commit()

    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "admin_poll"

    # 1. Update ke 1 detik -> Sukses
    res1 = client.put("/api/v1/kasir/settings/client-polling-interval", json={"interval_seconds": 1})
    assert res1.status_code == 200
    assert res1.get_json()["interval_seconds"] == 1
    assert SettingsService.get_client_polling_interval() == 1

    # 2. Update ke 10 detik -> Sukses
    res10 = client.put("/api/v1/kasir/settings/client-polling-interval", json={"interval_seconds": 10})
    assert res10.status_code == 200
    assert res10.get_json()["interval_seconds"] == 10
    assert SettingsService.get_client_polling_interval() == 10

    # 3. Update ke 60 detik (invalid) -> Ditolak (400)
    res_inv = client.put("/api/v1/kasir/settings/client-polling-interval", json={"interval_seconds": 60})
    assert res_inv.status_code == 400
    assert "hanya boleh 1, 5, atau 10" in res_inv.get_json()["error"]


def test_polling_interval_included_in_client_status_and_identify(app_context):
    grup = Grup(nama="reguler")
    db.session.add(grup)
    db.session.commit()

    pc = PC(kode="PC-POLL-1", nama="PC Polling Test", ip_address="10.10.10.120", mac_address="AA:BB:CC:DD:EE:12", aktif=True, grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()

    # Set interval ke 10 detik
    SettingsService.set_client_polling_interval(10)

    # 1. Test payload identify
    id_res = ClientService.identify(pc.ip_address, pc.mac_address)
    assert id_res["valid"] is True
    assert id_res["polling_interval"] == 10

    # 2. Test payload get_status kosong
    st_res = ClientService.get_status(pc.ip_address, pc.mac_address)
    assert st_res["status"] == "kosong"
    assert st_res["polling_interval"] == 10

    # 3. Test payload get_status saat sesi aktif
    SesiService.buka_admin(pc.id, "sys-token-poll", admin_nama="SYSTEM")
    pc.is_admin_mode = True
    db.session.commit()

    st_act = ClientService.get_status(pc.ip_address, pc.mac_address, role="system")
    assert st_act["status"] == "system"
    assert st_act["polling_interval"] == 10


def test_polling_interval_included_in_telemetry_response(client, app_context):
    grup = Grup(nama="reguler")
    db.session.add(grup)
    db.session.commit()

    pc = PC(kode="PC-POLL-2", nama="PC Polling Test 2", ip_address="10.10.10.121", mac_address="AA:BB:CC:DD:EE:13", aktif=True, grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()

    SettingsService.set_client_polling_interval(1)

    payload = {
        "IpAddress": "10.10.10.121",
        "MacAddress": "AA:BB:CC:DD:EE:13",
        "CpuUsage": 15.0,
        "CpuTemp": 45.0,
        "GpuTemp": 50.0,
        "TotalRam": "16 GB",
        "NicSpeed": "1000 Mbps"
    }

    res = client.post("/api/v1/public/monitor/", json=payload, environ_base={"REMOTE_ADDR": "10.10.10.121"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["polling_interval"] == 1

