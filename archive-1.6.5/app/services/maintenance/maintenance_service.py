# app/services/maintenance/maintenance_service.py

"""Service layer untuk mengelola tiket perawatan dan pelaporan masalah PC.

Menangani logika pembuatan tiket, pembaruan status perbaikan, auto-disable/enable PC
saat terjadi kerusakan kritis, dan pengumpulan statistik data laporan perawatan.
"""

from datetime import datetime, timezone
from sqlalchemy import func
from app.models import db, PC, MaintenanceTicket
from app.utils.timezone_utils import format_display
from app.utils.logger import write_log
from app.utils.validators import validate_choice, validate_string_length, validate_integer_range
from app.services.write_lock import with_write_lock

class MaintenanceService:

    @staticmethod
    @with_write_lock
    def create_ticket(pc_id, reporter, kategori, prioritas, judul, deskripsi=None):
        """Buat tiket masalah baru.
        - Jika prioritas KRITIS -> PC dinonaktifkan otomatis.
        """
        pc = db.session.get(PC, pc_id)
        if not pc:
            raise ValueError(f"PC dengan ID {pc_id} tidak ditemukan.")

        kategori_valid = validate_choice(kategori, ["HARDWARE", "SOFTWARE", "JARINGAN", "LAINNYA"], field_name="Kategori Tiket", case_sensitive=False).upper()
        prioritas_valid = validate_choice(prioritas, ["RENDAH", "SEDANG", "TINGGI", "KRITIS"], field_name="Prioritas Tiket", case_sensitive=False).upper()
        judul_valid = validate_string_length(judul, min_len=3, max_len=150, field_name="Judul Tiket", required=True)
        deskripsi_valid = validate_string_length(deskripsi, min_len=0, max_len=1000, field_name="Deskripsi Tiket", required=False) if deskripsi else None

        ticket = MaintenanceTicket(
            pc_id=pc_id,
            reporter=reporter,
            kategori=kategori_valid,
            prioritas=prioritas_valid,
            judul=judul_valid,
            deskripsi=deskripsi_valid,
            status="BARU"
        )

        if prioritas_valid == "KRITIS":
            pc.aktif = False

        db.session.add(ticket)
        db.session.commit()
        
        detail_tiket = {
            "pc_kode": pc.kode,
            "reporter": reporter,
            "kategori": kategori_valid,
            "prioritas": prioritas_valid,
            "judul": judul_valid
        }
        write_log("BUAT_TIKET", f"Tiket {kategori_valid} PC {pc.kode} dibuat (Prioritas {prioritas_valid})", user=reporter, detail_json=detail_tiket)
        return ticket

    @staticmethod
    def get_tickets(status=None, pc_id=None, grup=None, limit=50):
        """Ambil list tiket perawatan untuk Dashboard Perawatan PC."""
        limit = validate_integer_range(limit, 1, 500, "Limit tiket")
        query = MaintenanceTicket.query
        if pc_id:
            query = query.filter_by(pc_id=pc_id)
        elif grup:
            from app.models.grup.grup import Grup
            query = query.join(PC).join(Grup).filter(Grup.nama == grup)

        if status:
            query = query.filter_by(status=status)
        
        tickets = query.order_by(MaintenanceTicket.created_at.desc()).limit(limit).all()
        return [t.to_dict() for t in tickets]

    @staticmethod
    @with_write_lock
    def update_status(ticket_id, status, resolved_by=None, resolusi=None, biaya=0):
        """Update status perbaikan tiket.
        - Jika status SELESAI -> re-enable PC otomatis.
        """
        ticket = db.session.get(MaintenanceTicket, ticket_id)
        if not ticket:
            raise ValueError(f"Tiket dengan ID {ticket_id} tidak ditemukan.")

        status_valid = validate_choice(status, ["BARU", "DIPROSES", "SELESAI", "DITOLAK"], field_name="Status Tiket", case_sensitive=False).upper()
        biaya_valid = validate_integer_range(biaya or 0, min_val=0, max_val=100_000_000, field_name="Biaya Perbaikan")
        resolusi_valid = validate_string_length(resolusi, min_len=0, max_len=1000, field_name="Resolusi Tiket", required=False) if resolusi else None

        ticket.status = status_valid
        
        if status_valid == "SELESAI":
            ticket.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
            ticket.resolved_by = resolved_by
            ticket.resolusi = resolusi_valid
            ticket.biaya = biaya_valid
            # PC hanya dihidupkan bila tidak ada tiket KRITIS lain yang masih terbuka.
            if ticket.pc:
                kritis_terbuka = MaintenanceTicket.query.filter(
                    MaintenanceTicket.pc_id == ticket.pc_id,
                    MaintenanceTicket.id != ticket.id,
                    MaintenanceTicket.prioritas == "KRITIS",
                    MaintenanceTicket.status.in_(["BARU", "DIPROSES"]),
                ).first()
                if not kritis_terbuka:
                    ticket.pc.aktif = True
        elif status_valid == "DITOLAK":
            ticket.resolusi = resolusi_valid

        db.session.commit()
        
        detail_tiket = {
            "pc_kode": ticket.pc.kode if ticket.pc else "",
            "status": status,
            "resolved_by": resolved_by,
            "biaya": biaya
        }
        write_log("UPDATE_TIKET", f"Tiket PC {ticket.pc.kode if ticket.pc else ''} diupdate ke {status}", user=resolved_by or "system", detail_json=detail_tiket)
        return ticket.to_dict()

    @staticmethod
    def _report_query(start_date=None, end_date=None, pc_id=None, grup=None, kategori=None):
        """Query dasar tiket SELESAI sesuai filter laporan."""
        query = MaintenanceTicket.query.filter_by(status="SELESAI")

        from app.utils.timezone_utils import get_local_date_range_utc

        if start_date and end_date and start_date == end_date:
            start_utc, end_utc = get_local_date_range_utc(start_date)
            query = query.filter(MaintenanceTicket.resolved_at >= start_utc, MaintenanceTicket.resolved_at < end_utc)
        else:
            if start_date:
                start_utc, _ = get_local_date_range_utc(start_date)
                query = query.filter(MaintenanceTicket.resolved_at >= start_utc)
            if end_date:
                _, end_utc = get_local_date_range_utc(end_date)
                query = query.filter(MaintenanceTicket.resolved_at < end_utc)
        if pc_id:
            query = query.filter_by(pc_id=pc_id)
        elif grup:
            from app.models.grup.grup import Grup
            query = query.join(PC).join(Grup).filter(Grup.nama == grup)
        if kategori:
            query = query.filter_by(kategori=kategori)
        return query

    @staticmethod
    def get_report_data(start_date=None, end_date=None, pc_id=None, grup=None, kategori=None, page=1, per_page=5):
        """Ringkasan global + satu halaman tiket agar riwayat besar tidak dimuat sekaligus."""
        query = MaintenanceService._report_query(start_date, end_date, pc_id, grup, kategori)

        total_kasus = query.count()
        total_biaya = int(query.with_entities(func.coalesce(func.sum(MaintenanceTicket.biaya), 0)).scalar() or 0)
        rata_rata_biaya = int(total_biaya / total_kasus) if total_kasus > 0 else 0

        breakdown = {"HARDWARE": 0, "SOFTWARE": 0, "JARINGAN": 0, "LAINNYA": 0}
        for kategori_nama, jumlah in query.with_entities(
            MaintenanceTicket.kategori, func.count(MaintenanceTicket.id)
        ).group_by(MaintenanceTicket.kategori).all():
            breakdown[kategori_nama] = breakdown.get(kategori_nama, 0) + jumlah

        pc_ids = query.with_entities(MaintenanceTicket.pc_id).subquery()
        top_rows = db.session.query(
            func.coalesce(PC.kode, "N/A"), func.count()
        ).select_from(pc_ids).outerjoin(PC, PC.id == pc_ids.c.pc_id).group_by(
            func.coalesce(PC.kode, "N/A")
        ).order_by(func.count().desc()).limit(5).all()

        page = max(1, int(page or 1))
        pages = max(1, -(-total_kasus // per_page))
        tickets = query.order_by(MaintenanceTicket.resolved_at.desc()) \
            .offset((page - 1) * per_page).limit(per_page).all()

        return {
            "list_tiket": [t.to_dict() for t in tickets],
            "total_biaya": total_biaya,
            "total_kasus": total_kasus,
            "rata_rata_biaya": rata_rata_biaya,
            "breakdown_kategori": breakdown,
            "pc_paling_sering_rusak": [{"pc_kode": k, "jumlah": v} for k, v in top_rows],
            "pagination": {"page": page, "per_page": per_page, "total": total_kasus, "pages": pages},
        }

    @staticmethod
    @with_write_lock
    def delete_ticket(ticket_id):
        """Hapus tiket perawatan."""
        ticket = db.session.get(MaintenanceTicket, ticket_id)
        if not ticket:
            raise ValueError(f"Tiket dengan ID {ticket_id} tidak ditemukan.")

        pc_id = ticket.pc_id
        buka_kritis = ticket.prioritas == "KRITIS" and ticket.status in ("BARU", "DIPROSES")

        db.session.delete(ticket)
        db.session.commit()

        # PC yang dinonaktifkan tiket KRITIS harus hidup lagi saat tiketnya dihapus.
        if buka_kritis and pc_id:
            kritis_lain = MaintenanceTicket.query.filter(
                MaintenanceTicket.pc_id == pc_id,
                MaintenanceTicket.prioritas == "KRITIS",
                MaintenanceTicket.status.in_(["BARU", "DIPROSES"]),
            ).first()
            if not kritis_lain:
                pc = db.session.get(PC, pc_id)
                if pc:
                    pc.aktif = True
                    db.session.commit()

        write_log("HAPUS_TIKET", f"Tiket dihapus", user="system", detail_json={"ticket_id": ticket_id})
        return True
