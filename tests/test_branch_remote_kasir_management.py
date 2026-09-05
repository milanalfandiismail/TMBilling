import pytest
from datetime import datetime, date
from app import create_app, db
from app.models import User, PC, Paket, Grup, Transaksi, MenuItem, TransaksiMenu, Settings, Branch
from app.services.branch.branch_service import BranchService
from app.services.report.report_service import ReportService


@pytest.fixture
def app_instance():
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
def test_setup(app_instance):
    with app_instance.app_context():
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", nama_lengkap="Administrator", role="admin", aktif=True)
            admin.set_password("admin123")
            db.session.add(admin)
        else:
            admin.nama_lengkap = "Administrator"

        kasir = User.query.filter_by(username="kasir_lokal").first()
        if not kasir:
            kasir = User(username="kasir_lokal", nama_lengkap="Kasir Lokal", role="kasir", aktif=True)
            kasir.set_password("kasir123")
            db.session.add(kasir)

        grup = Grup.query.filter_by(nama="Reguler").first()
        if not grup:
            grup = Grup(nama="Reguler")
            db.session.add(grup)
            db.session.flush()

        pc = PC(kode="PC-01", ip_address="192.168.1.101", grup_id=grup.id, aktif=True)
        db.session.add(pc)

        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=10000, grup_id=grup.id, aktif=True)
        db.session.add(paket)

        menu = MenuItem(nama="Kopi Tubruk", harga=5000, stok=50, is_active=True)
        db.session.add(menu)

        branch1 = Branch(nama="Milan Net", url="https://milan.local", api_key="key-1", aktif=True)
        branch2 = Branch(nama="Cabang Timur", url="https://timur.local", api_key="key-2", aktif=True)
        db.session.add_all([branch1, branch2])
        db.session.commit()

        yield {
            "admin": admin,
            "kasir": kasir,
            "pc": pc,
            "paket": paket,
            "menu": menu,
            "branch1": branch1,
            "branch2": branch2
        }


def test_get_remote_operators_list(app_instance, test_setup):
    """Memverifikasi daftar operator remote menampilkan statistik dan parsing cabang dengan tepat."""
    with app_instance.app_context():
        t1 = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=15000,
            menit=90,
            no_nota="TM-001",
            operator="milan (Remote: Milan Net)",
            dibuat_pada=datetime(2026, 9, 4, 10, 0)
        )
        t2 = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=20000,
            menit=120,
            no_nota="TM-002",
            operator="milan (Remote: Milan Net)",
            dibuat_pada=datetime(2026, 9, 4, 12, 0)
        )
        tm1 = TransaksiMenu(
            no_nota="TMM-001",
            menu_id=test_setup["menu"].id,
            jumlah=2,
            total_harga=10000,
            kasir_id=test_setup["admin"].id,
            operator="budi (Remote: Cabang Timur)",
            tanggal=datetime(2026, 9, 4, 11, 0)
        )
        db.session.add_all([t1, t2, tm1])
        db.session.commit()

        operators = BranchService.get_remote_operators()
        op_dict = {op["operator"]: op for op in operators}

        assert "milan (Remote: Milan Net)" in op_dict
        milan_data = op_dict["milan (Remote: Milan Net)"]
        assert milan_data["username"] == "milan"
        assert milan_data["branch_name"] == "Milan Net"
        assert milan_data["total_transaksi"] == 2
        assert milan_data["total_nominal"] == 35000
        assert milan_data["is_hidden"] is False

        assert "budi (Remote: Cabang Timur)" in op_dict
        budi_data = op_dict["budi (Remote: Cabang Timur)"]
        assert budi_data["username"] == "budi"
        assert budi_data["branch_name"] == "Cabang Timur"
        assert budi_data["total_transaksi"] == 1
        assert budi_data["total_nominal"] == 10000
        assert budi_data["is_hidden"] is False


def test_hide_and_restore_remote_operator(app_instance, test_setup):
    """Memverifikasi pengarsipan (hide) dan pemulihan (restore) operator remote."""
    with app_instance.app_context():
        t1 = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=15000,
            menit=90,
            no_nota="TM-010",
            operator="alex (Remote: Milan Net)",
            dibuat_pada=datetime.now()
        )
        db.session.add(t1)
        db.session.commit()

        # 1. Sebelum diarsip, muncul di get_kasir_list
        klist = ReportService.get_kasir_list(test_setup["admin"].id, "admin")
        assert any(k["nama"] == "alex (Remote: Milan Net)" for k in klist)

        # 2. Nonaktifkan / arsipkan
        ok, msg = BranchService.hide_remote_operator("alex (Remote: Milan Net)", "admin")
        assert ok is True
        assert "berhasil dinonaktifkan" in msg

        # Verifikasi flag is_hidden
        operators = BranchService.get_remote_operators()
        alex_data = next((op for op in operators if op["operator"] == "alex (Remote: Milan Net)"), None)
        assert alex_data is not None
        assert alex_data["is_hidden"] is True

        # Verifikasi hilang dari dropdown filter laporan aktif
        klist_after = ReportService.get_kasir_list(test_setup["admin"].id, "admin")
        assert not any(k["nama"] == "alex (Remote: Milan Net)" for k in klist_after)

        # Data transaksi tetap utuh & nama operator tetap tersimpan di histori transaksi
        t_check = Transaksi.query.filter_by(no_nota="TM-010").first()
        assert t_check.operator == "alex (Remote: Milan Net)"
        assert t_check.jumlah == 15000

        # 3. Pulihkan kembali (restore)
        ok_rest, msg_rest = BranchService.restore_remote_operator("alex (Remote: Milan Net)", "admin")
        assert ok_rest is True

        # Muncul kembali di dropdown
        klist_restored = ReportService.get_kasir_list(test_setup["admin"].id, "admin")
        assert any(k["nama"] == "alex (Remote: Milan Net)" for k in klist_restored)


def test_delete_remote_operator_permanent(app_instance, test_setup):
    """Memverifikasi hapus permanen: operator & user_id jadi NULL, fallback ke 'Kasir Lama', omzet tetap 100% utuh."""
    with app_instance.app_context():
        # Setup transaksi billing & menu
        t1 = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=25000,
            menit=150,
            no_nota="TM-DEL-001",
            operator="doni (Remote: Cabang Timur)",
            dibuat_pada=datetime.now()
        )
        tm1 = TransaksiMenu(
            no_nota="TMM-DEL-001",
            menu_id=test_setup["menu"].id,
            jumlah=2,
            total_harga=10000,
            kasir_id=test_setup["admin"].id,
            operator="doni (Remote: Cabang Timur)",
            tanggal=datetime.now()
        )
        db.session.add_all([t1, tm1])
        db.session.commit()

        # Arsipkan terlebih dahulu untuk memastikan dibersihkan juga dari hidden_operators
        BranchService.hide_remote_operator("doni (Remote: Cabang Timur)", "admin")
        assert "doni (Remote: Cabang Timur)" in BranchService.get_hidden_operators()

        # Eksekusi Hapus Permanen
        ok, msg = BranchService.delete_remote_operator("doni (Remote: Cabang Timur)", "admin")
        assert ok is True, f"delete_remote_operator failed with: {msg}"
        assert "berhasil dihapus permanen" in msg

        # Verifikasi:
        # 1. Kolom operator & user_id pada Transaksi menjadi None
        t_refreshed = Transaksi.query.filter_by(no_nota="TM-DEL-001").first()
        assert t_refreshed.operator is None
        assert t_refreshed.user_id is None
        assert t_refreshed.jumlah == 25000  # Nominal utuh 100%
        assert t_refreshed.to_dict()["kasir_nama"] == "Kasir Lama"

        # 2. Kolom operator & kasir_id pada TransaksiMenu menjadi None
        tm_refreshed = TransaksiMenu.query.filter_by(no_nota="TMM-DEL-001").first()
        assert tm_refreshed.operator is None
        assert tm_refreshed.kasir_id is None
        assert tm_refreshed.total_harga == 10000  # Nominal utuh 100%
        assert tm_refreshed.to_dict()["kasir_nama"] == "Kasir Lama"

        # 3. String operator sudah tidak ada di hidden_operators
        assert "doni (Remote: Cabang Timur)" not in BranchService.get_hidden_operators()

        # 4. Total pendapatan laporan tetap 35000 (tidak berkurang 1 perak pun)
        rep = ReportService.get_laporan_by_tanggal(str(date.today()))
        assert rep["total_pendapatan_billing"] == 25000
        assert rep["total_pendapatan_menu"] == 10000
        assert rep["total_pendapatan"] == 35000


def test_branch_operator_api_endpoints_rbac(app_instance, test_setup):
    """Memverifikasi proteksi role admin pada API endpoint kasir remote."""
    client = app_instance.test_client()

    # 1. Unauthenticated -> 401 Unauthorized
    res = client.get("/api/v1/kasir/branch/operators")
    assert res.status_code == 401

    # 2. Role Kasir -> 403 Forbidden
    with client.session_transaction() as sess:
        sess["kasir_id"] = test_setup["kasir"].id
        sess["kasir_username"] = test_setup["kasir"].username
        sess["kasir_role"] = "kasir"

    res_kasir_get = client.get("/api/v1/kasir/branch/operators")
    assert res_kasir_get.status_code == 403

    res_kasir_hide = client.post("/api/v1/kasir/branch/operators/hide", json={"operator": "test"})
    assert res_kasir_hide.status_code == 403

    res_kasir_restore = client.post("/api/v1/kasir/branch/operators/restore", json={"operator": "test"})
    assert res_kasir_restore.status_code == 403

    res_kasir_del = client.post("/api/v1/kasir/branch/operators/delete", json={"operator": "test"})
    assert res_kasir_del.status_code == 403

    # 3. Role Admin -> 200 OK
    with client.session_transaction() as sess:
        sess["kasir_id"] = test_setup["admin"].id
        sess["kasir_username"] = test_setup["admin"].username
        sess["kasir_role"] = "admin"

    res_admin_get = client.get("/api/v1/kasir/branch/operators")
    assert res_admin_get.status_code == 200
    json_get = res_admin_get.get_json()
    assert json_get["success"] is True
    assert isinstance(json_get["data"], list)

    res_admin_hide = client.post("/api/v1/kasir/branch/operators/hide", json={"operator": "operator_test (Remote: Test)"})
    assert res_admin_hide.status_code == 200
    assert res_admin_hide.get_json()["success"] is True

    res_admin_restore = client.post("/api/v1/kasir/branch/operators/restore", json={"operator": "operator_test (Remote: Test)"})
    assert res_admin_restore.status_code == 200
    assert res_admin_restore.get_json()["success"] is True

    res_admin_del = client.post("/api/v1/kasir/branch/operators/delete", json={"operator": "operator_test (Remote: Test)"})
    assert res_admin_del.status_code == 200
    assert res_admin_del.get_json()["success"] is True
