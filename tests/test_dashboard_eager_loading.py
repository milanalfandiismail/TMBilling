import uuid
import pytest
from sqlalchemy import event
from app import create_app
from app.models import db, PC, Sesi, Member, User, Paket, Grup
from app.services.dashboard.dashboard_service import DashboardService


def test_dashboard_get_pc_list_query_count_is_constant():
    """Memastikan DashboardService.get_pc_list melakukan eager loading terhadap relasi Sesi
    (member, user, paket, pc) sehingga jumlah query SQL konstan O(1) dan bebas dari N+1 problem."""
    app = create_app()
    with app.app_context():
        tag = uuid.uuid4().hex[:6]
        # Setup data: 1 grup, 5 PCs, 5 Member/Paket/Sesi
        grup = Grup.query.filter_by(nama="reguler").first()
        if not grup:
            grup = Grup(nama="reguler", warna="#3b82f6")
            db.session.add(grup)
            db.session.commit()

        paket = Paket.query.first()
        if not paket:
            paket = Paket(nama=f"Paket 1 Jam {tag}", durasi_menit=60, harga=5000, grup_id=grup.id)
            db.session.add(paket)
            db.session.commit()

        # Buat 5 PC dengan 5 Sesi aktif
        pcs = []
        for i in range(1, 6):
            pc = PC(kode=f"PC-{tag}-{i}", nama=f"PC Eager {tag} {i}", ip_address=f"10.99.10.{i}", grup_id=grup.id, aktif=True)
            db.session.add(pc)
            pcs.append(pc)
        db.session.commit()

        sesi_list = []
        for i, pc in enumerate(pcs):
            member = Member(username=f"mem_{tag}_{i}", nama_lengkap=f"Member Eager {i}", grup_id=grup.id)
            member.set_password("pass123")
            db.session.add(member)
            db.session.commit()

            sesi = Sesi(
                pc_id=pc.id,
                member_id=member.id,
                paket_id=paket.id,
                tipe="member",
                status="aktif",
                durasi_beli_menit=60
            )
            db.session.add(sesi)
            sesi_list.append(sesi)
        db.session.commit()

        # Expire session cache agar tidak ada objek yang menempel di SQLAlchemy identity map
        db.session.expire_all()

        # Hitung jumlah query SQL yang dieksekusi saat get_pc_list dipanggil
        queries = []
        def count_queries(conn, cursor, statement, parameters, context, executemany):
            queries.append(statement)

        event.listen(db.engine, "before_cursor_execute", count_queries)
        try:
            result = DashboardService.get_pc_list()
            assert result is not None
            assert len(result["pc_list"]) >= 5
        finally:
            event.remove(db.engine, "before_cursor_execute", count_queries)

        # Cari query yang mengakses tabel member secara terpisah
        # Tanpa eager loading, akan ada query terpisah untuk SELECT FROM member
        member_queries = [q for q in queries if "FROM member" in q and "WHERE member.id" in q]
        assert len(member_queries) == 0, f"Terdeteksi N+1 query terpisah untuk member ({len(member_queries)} queries)"
