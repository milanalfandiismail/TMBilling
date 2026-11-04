import unittest
from datetime import timedelta

from sqlalchemy import event

from app import create_app
from app.models import db, Grup, Member, PC, Paket, Sesi, now_local
from app.services.cache.system_cache_store import SettingsCacheStore


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


class TestMemberListQueries(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-member-list",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        # Cache settings hangat seperti server produksi (lihat
        # tests/test_query_counts.py): timezone di-cache supaya hitungan
        # query hanya mengukur N+1 daftar member, bukan lookup settings.
        SettingsCacheStore.set("timezone", "Asia/Makassar")
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
        db.session.add(paket)
        db.session.flush()
        for i in range(20):
            m = Member(username=f"member{i}", nama_lengkap=f"Member {i}",
                       grup_id=grup.id, aktif=True, waktu_tersimpan=60)
            m.set_password("rahasia")
            db.session.add(m)
            db.session.flush()
            if i % 2 == 0:
                pc = PC(kode=f"TM-{i:02d}", nama=f"TM-{i}", grup_id=grup.id, aktif=True)
                db.session.add(pc)
                db.session.flush()
                db.session.add(Sesi(
                    tipe="member", member_id=m.id, pc_id=pc.id, paket_id=paket.id,
                    durasi_beli_menit=60, total_bayar=5000, status="aktif",
                    waktu_tersimpan_awal=60,
                    mulai_pada=now_local() - timedelta(minutes=5),
                    token_sesi="e" * 20 + str(i),
                ))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_member_list_query_count_is_constant(self):
        from app.repositories.member.member_repository import MemberRepository

        def _load():
            pagination = MemberRepository.get_paginated(page=1, per_page=20)
            # to_dict() dipanggil di dalam region terhitung: di sinilah
            # lazy load sesi_list/grup menimbulkan N+1.
            return [m.to_dict() for m in pagination.items]

        payload, queries = count_queries(_load)
        self.assertEqual(len(payload), 20)
        self.assertLessEqual(queries, 4)
