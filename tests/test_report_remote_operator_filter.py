import pytest
from datetime import datetime, date
from app import create_app, db
from app.models import User, PC, Paket, Grup, Sesi, Transaksi, MenuItem, TransaksiMenu
from app.models.branch import Branch
from app.services.report.report_service import ReportService
from app.services.sesi.sesi_service import SesiService
from app.services.menu.menu_service import MenuService
from app.services.report.pdf_export_service import PdfExportService


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
        # Dapatkan atau buat user admin lokal
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", nama_lengkap="Administrator", role="admin", aktif=True)
            admin.set_password("admin123")
            db.session.add(admin)
        else:
            admin.nama_lengkap = "Administrator"

        # Buat user kasir lokal
        kasir1 = User.query.filter_by(username="kasir1").first()
        if not kasir1:
            kasir1 = User(username="kasir1", nama_lengkap="Kasir Satu", role="kasir", aktif=True)
            kasir1.set_password("kasir123")
            db.session.add(kasir1)

        # Buat grup & PC
        grup = Grup.query.filter_by(nama="Reguler").first()
        if not grup:
            grup = Grup(nama="Reguler")
            db.session.add(grup)
            db.session.flush()

        pc = PC(kode="PC-01", ip_address="192.168.1.101", grup_id=grup.id, aktif=True)
        db.session.add(pc)

        # Buat paket
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=10000, grup_id=grup.id, aktif=True)
        db.session.add(paket)

        # Buat menu item
        menu = MenuItem(nama="Kopi Tubruk", harga=5000, stok=50, is_active=True)
        db.session.add(menu)

        # Buat data cabang aktif
        branch = Branch(nama="Milan Net", url="https://milan.local", api_key="test-key-123", aktif=True)
        db.session.add(branch)

        db.session.commit()

        yield {
            "admin": admin,
            "kasir1": kasir1,
            "pc": pc,
            "paket": paket,
            "menu": menu,
            "branch": branch
        }


def test_model_operator_column_and_fallback(app_instance, test_setup):
    """Memverifikasi kolom operator di model Transaksi & TransaksiMenu serta fallback to_dict()."""
    with app_instance.app_context():
        # Transaksi lama (operator None)
        t_lama = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=10000,
            menit=60,
            keterangan="Lama",
            operator=None
        )
        # Transaksi baru lokal
        t_lokal = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=10000,
            menit=60,
            keterangan="Lokal",
            operator="admin"
        )
        # Transaksi baru remote
        t_remote = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=15000,
            menit=90,
            keterangan="Remote",
            operator="admin (Remote: Milan Net)"
        )
        db.session.add_all([t_lama, t_lokal, t_remote])
        db.session.commit()

        assert t_lama.to_dict()["kasir_nama"] == "Administrator"
        assert t_lokal.to_dict()["kasir_nama"] == "admin"
        assert t_remote.to_dict()["kasir_nama"] == "admin (Remote: Milan Net)"


def test_recording_operator_in_services(app_instance, test_setup):
    """Memverifikasi penyimpanan identitas operator riil melalui Service Layer."""
    with app_instance.app_context():
        # 1. Buka guest via sesi_service dengan operator remote
        sesi = SesiService.buka_guest(
            pc_kode="PC-01",
            paket_id=test_setup["paket"].id,
            nama_guest="Guest Remote",
            operator="admin (Remote: Milan Net)",
            metode_pembayaran="Tunai"
        )
        t = Transaksi.query.filter_by(sesi_id=sesi.id).first()
        assert t is not None
        assert t.operator == "admin (Remote: Milan Net)"
        assert t.user_id == test_setup["admin"].id

        # 2. Beli menu via menu_service dengan operator remote
        cart_items = [{"menu_id": test_setup["menu"].id, "jumlah": 2}]
        res = MenuService.checkout_menu_order(
            cart_items=cart_items,
            pc_kode="PC-01",
            kasir_username="admin (Remote: Milan Net)",
            operator="admin (Remote: Milan Net)",
            tunai=20000,
            kembalian=10000,
            metode_pembayaran="Tunai"
        )
        assert len(res) == 1
        assert res[0]["total_harga"] == 10000
        tm = TransaksiMenu.query.filter_by(no_nota=res[0]["no_nota"]).first()
        assert tm is not None
        assert tm.operator == "admin (Remote: Milan Net)"
        assert tm.kasir_id == test_setup["admin"].id


def test_get_kasir_list_dropdown(app_instance, test_setup):
    """Memverifikasi endpoint dropdown kasir menyertakan kasir lokal dan remote operator terdaftar."""
    with app_instance.app_context():
        # Tambahkan 1 transaksi remote ke DB
        t_remote = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=10000,
            menit=60,
            no_nota="TM-20260904-999",
            operator="admin (Remote: Milan Net)"
        )
        db.session.add(t_remote)
        db.session.commit()

        kasir_list = ReportService.get_kasir_list(kasir_id=test_setup["admin"].id, kasir_role="admin")
        labels = [k["nama"] for k in kasir_list]
        ids = [k["id"] for k in kasir_list]

        # Harus ada opsi kasir lokal bertanda (Lokal)
        assert "Administrator (Lokal)" in labels or "admin (Lokal)" in labels
        assert "Kasir Satu (Lokal)" in labels or "kasir1 (Lokal)" in labels

        # Harus ada opsi remote operator
        assert "admin (Remote: Milan Net)" in labels
        assert "operator:admin (Remote: Milan Net)" in ids


def test_billing_and_canteen_filtering_separation(app_instance, test_setup):
    """Memverifikasi pemisahan filter omzet dan transaksi billing & kantin antara lokal vs remote."""
    with app_instance.app_context():
        today_date = date.today()

        # 1. Buat Transaksi Billing Lokal: Rp10.000
        t_lokal = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=10000,
            menit=60,
            no_nota="TM-20260904-001",
            operator="admin",
            dibuat_pada=datetime.now()
        )
        # 2. Buat Transaksi Billing Remote: Rp25.000
        t_remote = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=25000,
            menit=150,
            no_nota="TM-20260904-002",
            operator="admin (Remote: Milan Net)",
            dibuat_pada=datetime.now()
        )
        # 3. Buat Transaksi Menu Lokal: Rp5.000
        tm_lokal = TransaksiMenu(
            no_nota="TMM-20260904-001",
            menu_id=test_setup["menu"].id,
            jumlah=1,
            total_harga=5000,
            kasir_id=test_setup["admin"].id,
            operator="admin",
            tanggal=datetime.now()
        )
        # 4. Buat Transaksi Menu Remote: Rp15.000
        tm_remote = TransaksiMenu(
            no_nota="TMM-20260904-002",
            menu_id=test_setup["menu"].id,
            jumlah=3,
            total_harga=15000,
            kasir_id=test_setup["admin"].id,
            operator="admin (Remote: Milan Net)",
            tanggal=datetime.now()
        )
        db.session.add_all([t_lokal, t_remote, tm_lokal, tm_remote])
        db.session.commit()

        # CASE A: Semua Kasir (tanpa filter)
        rep_all = ReportService.get_laporan_by_tanggal(str(today_date))
        assert rep_all["total_pendapatan_billing"] == 35000
        assert rep_all["total_pendapatan_menu"] == 20000
        assert rep_all["total_pendapatan"] == 55000

        # CASE B: Filter Kasir Lokal (User ID admin)
        rep_lokal = ReportService.get_laporan_by_tanggal(str(today_date), kasir_id=str(test_setup["admin"].id))
        assert rep_lokal["total_pendapatan_billing"] == 10000
        assert rep_lokal["total_pendapatan_menu"] == 5000
        assert rep_lokal["total_pendapatan"] == 15000
        assert len(rep_lokal["history_struk"]) == 1
        assert rep_lokal["history_struk"][0]["kasir_nama"] == "admin"

        # CASE C: Filter Operator Remote
        rep_remote = ReportService.get_laporan_by_tanggal(str(today_date), kasir_id="operator:admin (Remote: Milan Net)")
        assert rep_remote["total_pendapatan_billing"] == 25000
        assert rep_remote["total_pendapatan_menu"] == 15000
        assert rep_remote["total_pendapatan"] == 40000
        assert len(rep_remote["history_struk"]) == 1
        assert rep_remote["history_struk"][0]["kasir_nama"] == "admin (Remote: Milan Net)"

        # CASE D: Filter Laporan Kantin secara terpisah
        kantin_lokal = ReportService.get_laporan_kantin_by_tanggal(str(today_date), kasir_id=str(test_setup["admin"].id))
        assert kantin_lokal["total_pendapatan_menu"] == 5000
        assert len(kantin_lokal["history_menu"]) == 1
        assert kantin_lokal["history_menu"][0]["kasir_nama"] == "admin"

        kantin_remote = ReportService.get_laporan_kantin_by_tanggal(str(today_date), kasir_id="operator:admin (Remote: Milan Net)")
        assert kantin_remote["total_pendapatan_menu"] == 15000
        assert len(kantin_remote["history_menu"]) == 1
        assert kantin_remote["history_menu"][0]["kasir_nama"] == "admin (Remote: Milan Net)"


def test_pdf_export_with_remote_operator(app_instance, test_setup):
    """Memverifikasi ekspor PDF laporan billing berjalan tanpa error dengan filter remote operator."""
    with app_instance.app_context():
        today_date = date.today()
        t_remote = Transaksi(
            user_id=test_setup["admin"].id,
            jenis="beli_paket_guest",
            jumlah=20000,
            menit=120,
            no_nota="TM-20260904-005",
            operator="admin (Remote: Milan Net)",
            dibuat_pada=datetime.now()
        )
        db.session.add(t_remote)
        db.session.commit()

        pdf_bytes, filename = ReportService.export_billing_pdf(str(today_date), kasir_id="operator:admin (Remote: Milan Net)")
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 1000
        assert pdf_bytes.startswith(b"%PDF")
        assert "admin_(Remote:_Milan_Net)" in filename
