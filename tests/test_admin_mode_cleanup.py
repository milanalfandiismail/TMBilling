import pytest
from datetime import timedelta
from app import create_app
from app.models import db, PC, Grup
from app.models.base.base import now_local
from app.services.sesi.sesi_service import SesiService
from app.services.cache.client_state_store import OnlineStatusStore


def test_cleanup_inactive_admin_sessions_preserves_active_ram_heartbeat():
    """Memastikan PC dalam mode admin TIDAK di-reset jika OnlineStatusStore di RAM
    masih mendeteksi heartbeat aktif (< 30 detik), meskipun kolom pc.last_activity di DB sudah kadaluarsa."""
    app = create_app()
    with app.app_context():
        # Setup Grup & PC
        grup = Grup.query.first()
        if not grup:
            grup = Grup(nama="VIP")
            db.session.add(grup)
            db.session.commit()

        pc = PC(
            nama="PC-ADMIN-TEST",
            kode="PC-998",
            ip_address="192.168.1.98",
            mac_address="AA:BB:CC:DD:EE:98",
            grup_id=grup.id,
            is_admin_mode=True,
            last_activity=now_local() - timedelta(seconds=60) # DB stale (> 30s)
        )
        db.session.add(pc)
        db.session.commit()

        try:
            # Simulasi PC masih aktif mengirim heartbeat ke OnlineStatusStore di RAM
            OnlineStatusStore.mark_active(pc.id)

            # Jalankan cleanup
            SesiService.cleanup_inactive_admin_sessions()

            # Refresh PC dari DB
            db.session.refresh(pc)

            # Harusnya TETAP True karena PC terbukti aktif di RAM
            assert pc.is_admin_mode is True, "Mode admin tidak boleh dimatikan jika RAM store heartbeat aktif!"

            # Sekarang simulasi heartbeat di RAM mati / dihapus
            OnlineStatusStore.remove(pc.id)

            # Jalankan cleanup lagi
            SesiService.cleanup_inactive_admin_sessions()
            db.session.refresh(pc)

            # Sekarang harusnya False karena DB stale dan RAM tidak aktif
            assert pc.is_admin_mode is False, "Mode admin harus dimatikan jika RAM store dan DB sama-sama mati!"
        finally:
            OnlineStatusStore.remove(pc.id)
            db.session.delete(pc)
            db.session.commit()
