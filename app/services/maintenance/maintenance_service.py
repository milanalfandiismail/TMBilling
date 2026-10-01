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

class MaintenanceService:

    @staticmethod
    def create_ticket(pc_id, reporter, kategori, prioritas, judul, deskripsi=None):
        """Buat tiket masalah baru.
        - Jika prioritas KRITIS -> PC dinonaktifkan otomatis.
        """
        pc = PC.query.get(pc_id)
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
    def update_status(ticket_id, status, resolved_by=None, resolusi=None, biaya=0):
        """Update status perbaikan tiket.
        - Jika status SELESAI -> re-enable PC otomatis.
        """
        ticket = MaintenanceTicket.query.get(ticket_id)
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
    def get_report_data(start_date=None, end_date=None, pc_id=None, grup=None, kategori=None):
        """Data laporan keuangan & analisis kerusakan."""
        query = MaintenanceTicket.query.filter_by(status="SELESAI")
        
        from app.utils.timezone_utils import get_local_date_range_utc

        if start_date and end_date and start_date == end_date:
            try:
                start_utc, end_utc = get_local_date_range_utc(start_date)
                query = query.filter(MaintenanceTicket.resolved_at >= start_utc, MaintenanceTicket.resolved_at < end_utc)
            except Exception:
                pass
        else:
            if start_date:
                try:
                    start_utc, _ = get_local_date_range_utc(start_date)
                    query = query.filter(MaintenanceTicket.resolved_at >= start_utc)
                except Exception:
                    pass
            if end_date:
                try:
                    _, end_utc = get_local_date_range_utc(end_date)
                    query = query.filter(MaintenanceTicket.resolved_at < end_utc)
                except Exception:
                    pass
        if pc_id:
            query = query.filter_by(pc_id=pc_id)
        elif grup:
            from app.models.grup.grup import Grup
            query = query.join(PC).join(Grup).filter(Grup.nama == grup)
            
        if kategori:
            query = query.filter_by(kategori=kategori)

        tickets = query.order_by(MaintenanceTicket.resolved_at.desc()).all()

        total_biaya = sum(t.biaya for t in tickets)
        total_kasus = len(tickets)
        rata_rata_biaya = int(total_biaya / total_kasus) if total_kasus > 0 else 0

        # Breakdown kategori
        breakdown = {"HARDWARE": 0, "SOFTWARE": 0, "JARINGAN": 0, "LAINNYA": 0}
        for t in tickets:
            if t.kategori in breakdown:
                breakdown[t.kategori] += 1
            else:
                breakdown[t.kategori] = breakdown.get(t.kategori, 0) + 1

        # Top 5 PC paling sering rusak
        pc_counts = {}
        for t in tickets:
            pc_kode = t.pc.kode if t.pc else "N/A"
            pc_counts[pc_kode] = pc_counts.get(pc_kode, 0) + 1
        
        top_pcs = sorted(pc_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        top_pcs_list = [{"pc_kode": k, "jumlah": v} for k, v in top_pcs]

        return {
            "list_tiket": [t.to_dict() for t in tickets],
            "total_biaya": total_biaya,
            "total_kasus": total_kasus,
            "rata_rata_biaya": rata_rata_biaya,
            "breakdown_kategori": breakdown,
            "pc_paling_sering_rusak": top_pcs_list
        }

    @staticmethod
    def delete_ticket(ticket_id):
        """Hapus tiket perawatan."""
        ticket = MaintenanceTicket.query.get(ticket_id)
        if not ticket:
            raise ValueError(f"Tiket dengan ID {ticket_id} tidak ditemukan.")

        db.session.delete(ticket)
        db.session.commit()
        write_log("HAPUS_TIKET", f"Tiket dihapus", user="system", detail_json={"ticket_id": ticket_id})
        return True
