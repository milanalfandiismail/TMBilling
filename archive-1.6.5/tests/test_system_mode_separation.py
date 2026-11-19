import pytest
from app import create_app, db
from app.models import PC, Sesi, User, Settings, Grup
from app.services import SettingsService, PCService, ClientService, SesiService, DashboardService


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


def test_system_mode_distinction_in_pc_to_dict_and_dashboard(app_context):
    grup = Grup(nama="reguler")
    db.session.add(grup)
    db.session.commit()

    # 1. Setup PC
    pc = PC(kode="PC-TEST-SYS", nama="PC Test System", ip_address="10.10.10.98", mac_address="AA:BB:CC:DD:EE:98", aktif=True, grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()

    # Status awal: kosong
    d_init = pc.to_dict()
    assert d_init["is_system_mode"] is False
    assert d_init["is_admin_mode"] is False
    assert d_init["status"] == "kosong"

    # 2. Sesi Emergency / System
    token_sys = "sys-token-12345"
    pc.is_admin_mode = True
    sesi_sys = SesiService.buka_admin(pc.id, token_sys, admin_nama="SYSTEM")
    db.session.commit()

    # Cek to_dict untuk SYSTEM
    d = pc.to_dict()
    assert d["is_system_mode"] is True
    assert d["is_admin_mode"] is False
    assert d["status"] == "system"

    # Cek DashboardService get_pc_list
    res = DashboardService.get_pc_list()
    target = next((p for p in res["pc_list"] if p["id"] == pc.id), None)
    assert target is not None
    assert target["is_system_mode"] is True
    assert target["is_admin_mode"] is False
    assert target["status"] == "system"
    assert target["is_system"] is True
    assert target["is_admin"] is False

    # 3. Bersihkan sesi system via reset_admin_mode
    PCService.reset_admin_mode(pc.id, operator="admin")
    d_after = pc.to_dict()
    assert d_after["is_system_mode"] is False
    assert d_after["is_admin_mode"] is False
    assert d_after["status"] == "kosong"

    # 4. Sesi Admin Resmi (bukan SYSTEM)
    token_admin = "admin-token-54321"
    pc.is_admin_mode = True
    sesi_admin = SesiService.buka_admin(pc.id, token_admin, admin_nama="Admin Utama")
    db.session.commit()

    d_adm = pc.to_dict()
    assert d_adm["is_system_mode"] is False
    assert d_adm["is_admin_mode"] is True
    assert d_adm["status"] == "admin"

    res_adm = DashboardService.get_pc_list()
    target_adm = next((p for p in res_adm["pc_list"] if p["id"] == pc.id), None)
    assert target_adm is not None
    assert target_adm["is_system_mode"] is False
    assert target_adm["is_admin_mode"] is True
    assert target_adm["status"] == "admin"
    assert target_adm["is_system"] is False
    assert target_adm["is_admin"] is True


def test_remote_action_blocked_on_system_mode(client, app_context):
    from app.models import ShiftRecord, now_local

    grup = Grup(nama="reguler")
    db.session.add(grup)
    admin = User.query.filter_by(role="admin").first()
    if not admin:
        admin = User(username="admin", role="admin", aktif=True)
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.commit()

    shift = ShiftRecord(kasir_id=admin.id, modal_awal=50000, status="AKTIF", waktu_mulai=now_local())
    db.session.add(shift)

    pc = PC(kode="PC-TEST-SYS2", nama="PC Test System 2", ip_address="10.10.10.99", mac_address="AA:BB:CC:DD:EE:99", aktif=True, grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()

    token_sys = "sys-token-67890"
    pc.is_admin_mode = True
    SesiService.buka_admin(pc.id, token_sys, admin_nama="SYSTEM")
    db.session.commit()

    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "admin"
        sess["shift_id"] = shift.id

    # 1. Test trigger remote restart pada PC mode SYSTEM -> Ditolak (403)
    res_restart = client.post(f"/api/v1/kasir/monitor/remote/{pc.id}/restart")
    assert res_restart.status_code == 403
    data_restart = res_restart.get_json()
    assert data_restart["success"] is False
    assert "tidak diizinkan pada PC dalam mode SYSTEM" in data_restart["error"]

    # 2. Test trigger remote shutdown pada PC mode SYSTEM -> Ditolak (403)
    res_shutdown = client.post(f"/api/v1/kasir/monitor/remote/{pc.id}/shutdown")
    assert res_shutdown.status_code == 403
    data_shutdown = res_shutdown.get_json()
    assert data_shutdown["success"] is False
    assert "tidak diizinkan pada PC dalam mode SYSTEM" in data_shutdown["error"]


def test_reset_admin_mode_queues_lock_and_responds_to_client_polling(app_context):
    grup = Grup(nama="reguler")
    db.session.add(grup)
    db.session.commit()

    pc = PC(kode="PC-TEST-SYS3", nama="PC Test System 3", ip_address="10.10.10.100", mac_address="AA:BB:CC:DD:EE:A1", aktif=True, grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()

    # Emergency login diaktifkan
    pc.is_admin_mode = True
    SesiService.buka_admin(pc.id, "sys-token-abc", admin_nama="SYSTEM")
    db.session.commit()

    # Saat masih aktif, client polling role admin/system dapat status system
    st_active = ClientService.get_status(pc.ip_address, pc.mac_address, role="system")
    assert st_active["status"] == "system"

    # Kasir melakukan Clear Sesi System via reset_admin_mode
    PCService.reset_admin_mode(pc.id, operator="admin")
    assert pc.is_admin_mode is False

    # Client polling berikutnya harus menerima status kosong dan command lock
    st_after = ClientService.get_status(pc.ip_address, pc.mac_address, role="admin")
    assert st_after["status"] == "kosong"
    assert st_after.get("command") == "lock"

