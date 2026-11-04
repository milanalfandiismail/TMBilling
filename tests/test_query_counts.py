import unittest

from sqlalchemy import event

from app import create_app
from app.models import db, Grup, PC, HardwareMonitor, Member, Sesi


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
        self.assertEqual(payload[0]["nama"], "pemain0")
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
