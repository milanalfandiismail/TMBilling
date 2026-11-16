import unittest

from sqlalchemy import event

from app import create_app
from app.models import db, Grup, PC, HardwareMonitor, Member, Sesi, User


def count_queries(fn):
    counter = {"n": 0}

    def _before(conn, cursor, statement, params, context, executemany):
        counter["n"] += 1

    event.listen(db.engine, "before_cursor_execute", _before)
    try:
        result = fn()
    finally:
        event.remove(db.engine, "before_cursor_execute", _before)
    return result, counter["n"]


class TestHardwareListQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-query-count",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        for i in range(5):
            pc = PC(kode=f"TM-{i+1}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            db.session.flush()
            db.session.add(HardwareMonitor(pc_id=pc.id, cpu_name="i5", gpu_name="RTX"))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_hardware_list_query_count_is_constant(self):
        from app.services.hardware.hardware_service import HardwareService
        monitors, queries = count_queries(HardwareService.get_all_with_pc)
        for m in monitors:
            _ = m.pc.kode, m.pc.grup.nama
        self.assertEqual(len(monitors), 5)
        self.assertLessEqual(queries, 4)

    def test_client_status_query_count_constant_with_members(self):
        from app.models import Member, Sesi
        from app.services.cache.system_cache_store import SettingsCacheStore
        from app.services.client.client_service import ClientService
        # Cache settings hangat seperti server produksi; jalur polling tidak
        # boleh menambah query member (sesi + grup) per PC.
        SettingsCacheStore.set("timezone", "Asia/Makassar")
        SettingsCacheStore.set("client_polling_interval_seconds", "5")
        grup = Grup.query.first()
        pcs = PC.query.all()
        for i in range(3):
            pcs[i].ip_address = f"10.10.0.{i + 1}"
            pcs[i].mac_address = f"AA:BB:CC:DD:EE:0{i}"
            m = Member(username=f"member{i}", password_hash="x", grup_id=grup.id,
                       waktu_tersimpan=60, aktif=True)
            db.session.add(m)
            db.session.flush()
            db.session.add(Sesi(tipe="member", member_id=m.id, pc_id=pcs[i].id,
                                durasi_beli_menit=60, status="aktif",
                                token_sesi=f"c{i}" * 20))
        db.session.commit()
        db.session.remove()
        pcs = PC.query.all()
        res, queries = count_queries(
            lambda: ClientService.get_status(pcs[0].ip_address, pcs[0].mac_address, role="member")
        )
        self.assertLessEqual(queries, 4)
        self.assertEqual(res["member"]["grup"], "reguler")
        self.assertEqual(res["member"]["waktu_tersimpan"], 60)


class TestPublicPCPortalQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-query-count",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        for i in range(5):
            pc = PC(kode=f"TM-{i+1}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            db.session.flush()
            if i < 3:
                m = Member(username=f"pemain{i}", password_hash="x", grup_id=grup.id,
                           waktu_tersimpan=60, aktif=True)
                db.session.add(m)
                db.session.flush()
                db.session.add(Sesi(tipe="member", member_id=m.id, pc_id=pc.id,
                                    durasi_beli_menit=60, status="aktif",
                                    token_sesi=f"p{i}" * 20))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_public_pc_status_query_count_constant(self):
        client = self.app.test_client()
        res, queries = count_queries(
            lambda: client.get("/pc-status"))
        self.assertLessEqual(queries, 8)
        payload = res.get_json()
        self.assertEqual(len(payload), 5)
        self.assertEqual(payload[0]["nama"], "Member")
        self.assertEqual(payload[0]["status"], "terpakai")
        self.assertEqual(payload[3]["nama"], "Tersedia")
        self.assertEqual(payload[3]["status"], "kosong")

    def test_public_specs_query_count_constant(self):
        from app.models import Paket
        grup = Grup.query.first()
        for i in range(5, 13):
            pc = PC(kode=f"TM-{i+1}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            db.session.flush()
            db.session.add(HardwareMonitor(pc_id=pc.id, cpu_name="i7", gpu_name="GTX"))
        db.session.add_all([
            Paket(nama="1 Jam", grup_id=grup.id, durasi_menit=60, harga=5000, aktif=True),
            Paket(nama="3 Jam", grup_id=grup.id, durasi_menit=180, harga=12000, aktif=True),
        ])
        db.session.commit()
        client = self.app.test_client()
        _, queries = count_queries(lambda: client.get("/spesifikasi"))
        self.assertLessEqual(queries, 10)


class TestArchivedMenuQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-query-count",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        from app.models import MenuItem, TransaksiMenu
        for i in range(6):
            menu = MenuItem(nama=f"Arsip {i}", harga=5000, stok=10, is_active=False)
            db.session.add(menu)
            db.session.flush()
            for j in range(i):  # menu ke-i punya i transaksi
                db.session.add(TransaksiMenu(no_nota=f"N{i}-{j}", menu_id=menu.id,
                                             jumlah=1, total_harga=5000))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_archived_menu_query_count_constant(self):
        from app.services.menu.menu_service import MenuService
        menus, queries = count_queries(MenuService.get_archived_menu)
        self.assertLessEqual(queries, 4)
        self.assertEqual([m["transaksi_count"] for m in menus], [i for i in range(6)])


class TestPCListQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-query-count",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        for i in range(12):
            pc = PC(kode=f"TM-{i+1}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            db.session.flush()
            if i < 3:
                m = Member(username=f"pemain{i}", password_hash="x", grup_id=grup.id,
                           waktu_tersimpan=60, aktif=True)
                db.session.add(m)
                db.session.flush()
                db.session.add(Sesi(tipe="member", member_id=m.id, pc_id=pc.id,
                                    durasi_beli_menit=60, status="aktif",
                                    token_sesi=f"q{i}" * 20))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_pc_list_query_count_constant(self):
        admin = User.query.filter_by(username="admin").first()
        client = self.app.test_client()
        with client.session_transaction() as sess:
            sess["kasir_id"] = admin.id
            sess["kasir_username"] = admin.username
            sess["kasir_role"] = "admin"
        res, queries = count_queries(lambda: client.get("/api/v1/kasir/pc/"))
        self.assertEqual(res.status_code, 200)
        payload = res.get_json()
        self.assertEqual(len(payload["pc_list"]), 12)
        self.assertEqual(payload["pc_list"][0]["status"], "terpakai")
        self.assertEqual(payload["grouped"]["reguler"][0]["sesi_id"],
                         payload["pc_list"][0]["sesi_id"])
        self.assertLessEqual(queries, 10)


class TestTelemetryQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-telemetry-count",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        pc = PC(kode="TM-1", nama="TM-1", grup_id=grup.id, aktif=True,
                ip_address="10.20.0.1", mac_address="AA:BB:CC:DD:EE:01")
        db.session.add(pc)
        db.session.flush()
        db.session.add(HardwareMonitor(pc_id=pc.id, cpu_name="i5", gpu_name="RTX"))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_telemetry_with_warm_cache_skips_pc_select(self):
        from app.services.cache.system_cache_store import PCNetworkCacheStore
        from app.services.hardware.hardware_service import HardwareService

        PCNetworkCacheStore.invalidate()
        PCNetworkCacheStore.resolve_pc(ip="10.20.0.1")  # warm cache, outside the count

        result, queries = count_queries(
            lambda: HardwareService.process_hardware_metric("10.20.0.1", {"CpuUsage": 10})
        )
        self.assertEqual(queries, 1)  # hanya SELECT hardware_monitor; tabel pc tidak di-query ulang
        self.assertEqual(result["kode"], "TM-1")


class TestScreenshotStatusQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-screenshot-count",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        for i in range(5):
            pc = PC(kode=f"TM-{i+1}", nama=f"TM-{i+1}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            db.session.flush()
            db.session.add(HardwareMonitor(pc_id=pc.id, cpu_name="i5"))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_get_all_light_loads_only_pc_and_grup(self):
        from sqlalchemy import inspect as sa_inspect
        from app.repositories.pc.pc_repository import PCRepository

        pcs, queries = count_queries(PCRepository.get_all_light)
        for pc in pcs:
            _ = pc.grup.nama
        self.assertEqual(len(pcs), 5)
        self.assertLessEqual(queries, 2)
        self.assertIn("hardware", sa_inspect(pcs[0]).unloaded)


class TestReportQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-report-count",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        from app.models import MenuItem, Paket, Transaksi, TransaksiMenu
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        user = User(username="kasir1", password_hash="x", role="kasir")
        member = Member(username="member1", password_hash="x", grup_id=grup.id, waktu_tersimpan=60, aktif=True)
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=10000, grup_id=grup.id)
        db.session.add_all([user, member, paket])
        db.session.flush()
        pc = PC(kode="TM-1", nama="TM-1", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.flush()
        sesi = Sesi(tipe="member", member_id=member.id, pc_id=pc.id,
                    durasi_beli_menit=60, status="aktif", token_sesi="t" * 40)
        db.session.add(sesi)
        db.session.flush()
        for i in range(5):
            menu = MenuItem(nama=f"Menu {i}", harga=5000, stok=10)
            db.session.add(menu)
            db.session.flush()
            db.session.add(TransaksiMenu(no_nota=f"FNB-{i}", menu_id=menu.id, jumlah=1,
                                         total_harga=5000, kasir_id=user.id))
            db.session.add(Transaksi(sesi_id=sesi.id, member_id=member.id, paket_id=paket.id,
                                     user_id=user.id, jenis="billing", jumlah=10000,
                                     no_nota=f"TRX-{i}", metode_pembayaran="Tunai"))
        db.session.commit()
        db.session.expire_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_history_struk_format_has_no_lazy_queries(self):
        from app.repositories.transaksi.transaksi_repository import TransaksiRepository
        from app.services.report.report_service import ReportService

        pagination = TransaksiRepository.get_history_nota_paginated(None, 1, 10, None, None, None)
        rows, queries = count_queries(lambda: ReportService._format_history_struk(pagination.items))
        self.assertEqual(len(rows), 5)
        self.assertEqual(queries, 0)

    def test_menu_names_have_no_lazy_queries(self):
        from app.repositories.menu.menu_repository import MenuRepository

        items = MenuRepository.get_transactions_by_date(None)
        names, queries = count_queries(lambda: [tm.menu.nama for tm in items])
        self.assertEqual(len(names), 5)
        self.assertEqual(queries, 0)
