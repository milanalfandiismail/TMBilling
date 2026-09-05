# app/services/branch/branch_inbound_service.py
"""Service layer untuk manajemen koneksi cabang masuk (Inbound Connections)."""

from typing import Optional, List, Dict, Tuple, Any
from app.models import db, now_local
from app.models.branch import BranchInbound


class BranchInboundService:
    """Service untuk mencatat, memantau, dan mengontrol akses server cabang pengontrol."""

    @staticmethod
    def record_inbound_access(
        origin_name: str,
        origin_mac: Optional[str] = None,
        origin_url: Optional[str] = None,
        operator: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> BranchInbound:
        """Mencatat atau memperbarui aktivitas koneksi masuk dari cabang pengontrol.
        
        Args:
            origin_name: Nama warnet cabang pengirim.
            origin_mac: MAC address hardware server pengirim jika tersedia.
            origin_url: Base URL server pengirim jika tersedia.
            operator: Username kasir/operator pengirim terakhir.
            ip_address: Alamat IP asal pengirim.

        Returns:
            BranchInbound: Objek record cabang inbound yang disimpan.
        """
        clean_name = (origin_name or "Cabang Luar").strip()
        clean_mac = origin_mac.strip() if origin_mac else None
        clean_url = origin_url.strip() if origin_url else None
        clean_op = operator.strip() if operator else None
        clean_ip = ip_address.strip() if ip_address else None

        inbound = None

        # 1. Cari berdasarkan MAC Address jika ada (paling akurat untuk hardware yang sama)
        if clean_mac:
            inbound = BranchInbound.query.filter_by(mac_address=clean_mac).first()

        # 2. Fallback cari berdasarkan nama warnet
        if not inbound and clean_name:
            inbound = BranchInbound.query.filter(BranchInbound.nama.ilike(clean_name)).first()

        now = now_local()

        if inbound:
            inbound.terakhir_aktif = now
            inbound.total_request += 1
            if clean_name and clean_name.lower() not in ("cabang", "remote"):
                inbound.nama = clean_name
            if clean_mac and not inbound.mac_address:
                inbound.mac_address = clean_mac
            if clean_url:
                inbound.url = clean_url
            if clean_op:
                inbound.operator_terakhir = clean_op
            if clean_ip:
                inbound.ip_address = clean_ip
        else:
            inbound = BranchInbound(
                nama=clean_name,
                url=clean_url,
                mac_address=clean_mac,
                ip_address=clean_ip,
                operator_terakhir=clean_op,
                total_request=1,
                status="aktif",
                pertama_terhubung=now,
                terakhir_aktif=now,
            )
            db.session.add(inbound)

        db.session.commit()
        return inbound

    @staticmethod
    def is_blocked(origin_name: Optional[str] = None, origin_mac: Optional[str] = None) -> bool:
        """Memeriksa apakah server cabang pengirim berstatus diblokir."""
        if origin_mac:
            clean_mac = origin_mac.strip()
            if clean_mac:
                blocked = BranchInbound.query.filter_by(mac_address=clean_mac, status="diblokir").first()
                if blocked:
                    return True

        if origin_name:
            clean_name = origin_name.strip()
            if clean_name and clean_name.lower() not in ("cabang", "remote"):
                blocked = BranchInbound.query.filter(
                    BranchInbound.nama.ilike(clean_name),
                    BranchInbound.status == "diblokir"
                ).first()
                if blocked:
                    return True

        return False

    @staticmethod
    def get_all_inbound() -> List[Dict[str, Any]]:
        """Mengambil seluruh riwayat koneksi cabang masuk terurut dari yang terakhir aktif."""
        items = BranchInbound.query.order_by(BranchInbound.terakhir_aktif.desc()).all()
        return [item.to_dict() for item in items]

    @staticmethod
    def toggle_block(inbound_id: int, block: bool) -> Tuple[bool, Any]:
        """Mengubah status koneksi cabang menjadi diblokir atau aktif."""
        inbound = db.session.get(BranchInbound, inbound_id)
        if not inbound:
            return False, "Data koneksi cabang tidak ditemukan"

        inbound.status = "diblokir" if block else "aktif"
        db.session.commit()
        return True, inbound.to_dict()

    @staticmethod
    def delete_inbound(inbound_id: int) -> Tuple[bool, str]:
        """Menghapus riwayat koneksi cabang masuk."""
        inbound = db.session.get(BranchInbound, inbound_id)
        if not inbound:
            return False, "Data koneksi cabang tidak ditemukan"

        db.session.delete(inbound)
        db.session.commit()
        return True, "Riwayat koneksi cabang berhasil dihapus"
