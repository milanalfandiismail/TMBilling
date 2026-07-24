# app/services/maintenance/maintenance_service.py

"""Service layer untuk mengelola tiket perawatan dan pelaporan masalah PC.

Menangani logika pembuatan tiket, pembaruan status perbaikan, auto-disable/enable PC
saat terjadi kerusakan kritis, dan pengumpulan statistik data laporan perawatan.
"""

from datetime import datetime, timezone
from sqlalchemy import func
from app.models import db, PC, MaintenanceTicket
from app.utils.timezone_utils import format_display

class MaintenanceService:

    @staticmethod
    def create_ticket(pc_id, reporter, kategori, prioritas, judul, deskripsi=None):
        """Buat tiket masalah baru.
        - Jika prioritas KRITIS -> PC dinonaktifkan otomatis.
        """
        pc = PC.query.get(pc_id)
        if not pc:
            raise ValueError(f"PC dengan ID {pc_id} tidak ditemukan.")

        valid_kategori = ["HARDWARE", "SOFTWARE", "JARINGAN", "LAINNYA"]
        if kategori not in valid_kategori:
            raise ValueError(f"Kategori tidak valid. Harus salah satu dari {valid_kategori}")

        valid_prioritas = ["RENDAH", "SEDANG", "TINGGI", "KRITIS"]
        if prioritas not in valid_prioritas:
            raise ValueError(f"Prioritas tidak valid. Harus salah satu dari {valid_prioritas}")

        ticket = MaintenanceTicket(
            pc_id=pc_id,
            reporter=reporter,
            kategori=kategori,
            prioritas=prioritas,
            judul=judul,
            deskripsi=deskripsi,
            status="BARU"
        )

        db.session.add(ticket)
        db.session.commit()
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

        valid_status = ["BARU", "DIPROSES", "SELESAI", "DITOLAK"]
        if status not in valid_status:
            raise ValueError(f"Status tidak valid. Harus salah satu dari {valid_status}")

        ticket.status = status
        
        if status == "SELESAI":
            ticket.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
            ticket.resolved_by = resolved_by
            ticket.resolusi = resolusi
            ticket.biaya = int(biaya or 0)
        elif status == "DITOLAK":
            ticket.resolusi = resolusi

        db.session.commit()
        return ticket.to_dict()

    @staticmethod
    def get_report_data(start_date=None, end_date=None, pc_id=None, grup=None, kategori=None):
        """Data laporan keuangan & analisis kerusakan."""
        query = MaintenanceTicket.query.filter_by(status="SELESAI")
        
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(MaintenanceTicket.resolved_at >= start_dt)
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                query = query.filter(MaintenanceTicket.resolved_at <= end_dt)
            except ValueError:
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
        return True
