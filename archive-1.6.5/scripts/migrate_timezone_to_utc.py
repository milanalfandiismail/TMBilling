# scripts/migrate_timezone_to_utc.py

"""Migrasi data timestamp dari WIB (UTC+7) ke UTC.

Sebelum fitur multi-timezone, semua timestamp disimpan sebagai
naive datetime dalam WIB (Asia/Jakarta, UTC+7).
Setelah fitur aktif, semua timestamp baru dalam UTC.

Script ini mengkonversi data existing WIB → UTC.

Cara jalan:
    cd C:\\Milan\\GIT\\TMBilling
    .venv\\scripts\\python scripts\\migrate_timezone_to_utc.py

Note:
    - Data di-asumsikan WIB (karena mayoritas server di Jawa)
    - Jika server bukan WIB, jalankan sekali setelah set timezone
"""

import sys
import os
from datetime import datetime, timedelta

# Tambah root project ke path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models import db
from app.models.member.member import Member
from app.models.sesi.sesi import Sesi
from app.models.transaksi.transaksi import Transaksi
from app.models.user.user import User
from app.models.paket.paket import Paket
from app.models.pc.pc import PC
from app.models.shift.shift_record import ShiftRecord
from app.models.tournament.tournament import Turnamen
from app.models.tournament.tournament import TurnamenTahap
from app.models.tournament.tournament import TurnamenTim
from app.models.tournament.tournament import TurnamenMatch
from app.models.menu.menu import TransaksiMenu
from app.models.hardware.hardware import HardwareMonitor
from app.models.hardware.hardware import PCProcess


# WIB offset: UTC+7 → kurangi 7 jam
WIB_TO_UTC_OFFSET = timedelta(hours=-7)


def migrate_model(model_class, columns, label):
    """Migrasi kolom datetime model dari WIB → UTC."""
    records = model_class.query.all()
    count = 0
    for rec in records:
        changed = False
        for col in columns:
            val = getattr(rec, col, None)
            if val is not None and isinstance(val, (datetime,)):
                # Kurangi 7 jam (WIB → UTC)
                setattr(rec, col, val + WIB_TO_UTC_OFFSET)
                changed = True
        if changed:
            count += 1
    db.session.commit()
    print(f"  {label}: {count}/{len(records)} record diupdate")
    return count


def main():
    from datetime import datetime

    app = create_app()
    with app.app_context():
        print("=" * 50)
        print("Migrasi data timestamp WIB → UTC")
        print("=" * 50)
        print()

        total = 0

        # Member
        total += migrate_model(Member, ["dibuat_pada", "kadaluarsa_pada"], "Member")

        # Sesi
        total += migrate_model(Sesi, ["mulai_pada", "selesai_pada"], "Sesi")

        # Transaksi
        total += migrate_model(Transaksi, ["dibuat_pada"], "Transaksi")

        # User
        total += migrate_model(User, ["dibuat_pada"], "User")

        # Paket
        total += migrate_model(Paket, ["dibuat_pada"], "Paket")

        # Shift Record
        total += migrate_model(ShiftRecord, ["waktu_mulai"], "ShiftRecord")

        # Tournament
        total += migrate_model(Turnamen, ["dibuat_pada"], "Turnamen")
        total += migrate_model(TurnamenTahap, ["dibuat_pada"], "TurnamenTahap")
        total += migrate_model(TurnamenTim, ["dibuat_pada"], "TurnamenTim")
        total += migrate_model(TurnamenMatch, ["dibuat_pada"], "TurnamenMatch")

        # Menu
        total += migrate_model(TransaksiMenu, ["tanggal"], "TransaksiMenu")

        # Hardware
        total += migrate_model(HardwareMonitor, ["last_update"], "HardwareMonitor")
        total += migrate_model(PCProcess, ["last_update"], "PCProcess")

        print()
        print("=" * 50)
        print(f"Total {total} record diupdate ke UTC.")
        print("Migrasi selesai!")
        print("=" * 50)


if __name__ == "__main__":
    main()
