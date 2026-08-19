import unittest
from datetime import datetime, date, timezone
import os
from app import create_app
from app.models import db, PC, Grup, PCUptimeLog, MaintenanceTicket, Sesi, HardwareMonitor, PCProcess
from app.services.settings.settings_service import SettingsService
from app.services.pc.pc_service import PCService
from app.services.hardware.hardware_service import TELEMETRY_HISTORY
from app.services.client.client_service import PENDING_COMMANDS

class TestPCUptimeTimezone(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Check if reguler grup already exists, if not create it
        self.grup = Grup.query.filter_by(nama="reguler").first()
        if not self.grup:
            self.grup = Grup(nama="reguler", warna="#3b82f6")
            db.session.add(self.grup)
            db.session.commit()

        self.pc = PC(kode="PC01", nama="PC 01", grup_id=self.grup.id, aktif=True)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_pc_uptime_to_dict_converts_utc_to_configured_timezone(self):
        # Set timezone to Asia/Makassar (WITA, UTC+8)
        SettingsService.set("timezone", "Asia/Makassar")

        # Create uptime log with UTC naive timestamp 15:00:00 (which corresponds to 23:00:00 WITA)
        utc_naive = datetime(2026, 8, 19, 15, 0, 0)
        log = PCUptimeLog(
            pc_id=self.pc.id,
            tanggal=date(2026, 8, 19),
            total_online_seconds=3600,
            total_billing_seconds=1800,
            first_seen=utc_naive,
            last_seen=utc_naive
        )
        db.session.add(log)
        db.session.commit()

        data = log.to_dict()

        # Database must still store UTC naive
        raw_log = PCUptimeLog.query.get(log.id)
        self.assertEqual(raw_log.first_seen, utc_naive)

        # Presentation layer must reflect Asia/Makassar (23:00)
        self.assertIn("23:00", data["first_seen_time"])
        self.assertIn("23:00", data["last_seen_time"])
        self.assertIn("+08:00", data["first_seen"])
        self.assertIn("WITA", data["first_seen_display"])


class TestPCHardDelete(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Check if reguler grup already exists, if not create it
        self.grup = Grup.query.filter_by(nama="reguler").first()
        if not self.grup:
            self.grup = Grup(nama="reguler", warna="#3b82f6")
            db.session.add(self.grup)
            db.session.commit()

        self.pc = PC(kode="PC01", nama="PC 01", ip_address="192.168.1.101", grup_id=self.grup.id, aktif=True)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_delete_pc_with_all_dependencies_succeeds(self):
        pc_id = self.pc.id

        # 1. Add Uptime Log (Category A)
        log = PCUptimeLog(pc_id=pc_id, tanggal=date(2026, 8, 19), total_online_seconds=100)
        db.session.add(log)

        # 2. Add Hardware Monitor (Category A)
        hw = HardwareMonitor(pc_id=pc_id, cpu_usage=25.0, cpu_temp=45.0)
        db.session.add(hw)

        # 3. Add PC Process (Category A)
        proc = PCProcess(pc_id=pc_id, name="game.exe", title="Game")
        db.session.add(proc)

        # 4. Add Maintenance Ticket (Category A)
        ticket = MaintenanceTicket(pc_id=pc_id, reporter="admin", kategori="HARDWARE", judul="Keyboard rusak")
        db.session.add(ticket)

        # 5. Add Finished Sesi (Category B)
        sesi = Sesi(tipe="guest", nama_guest="Budi", pc_id=pc_id, status="selesai")
        db.session.add(sesi)
        db.session.commit()

        # 6. Add In-Memory Cache/Queue
        TELEMETRY_HISTORY[pc_id] = [{"cpu_usage": 25.0}]
        PENDING_COMMANDS[pc_id] = "screenshot"

        # Execute Hard Delete
        result = PCService.delete(pc_id, operator="admin")
        self.assertTrue(result["success"])

        # Verification: PC must not exist in DB
        self.assertIsNone(PC.query.get(pc_id))

        # Verification: Category A records must be deleted
        self.assertEqual(PCUptimeLog.query.filter_by(pc_id=pc_id).count(), 0)
        self.assertEqual(HardwareMonitor.query.filter_by(pc_id=pc_id).count(), 0)
        self.assertEqual(PCProcess.query.filter_by(pc_id=pc_id).count(), 0)
        self.assertEqual(MaintenanceTicket.query.filter_by(pc_id=pc_id).count(), 0)

        # Verification: Category B (Sesi) is preserved with pc_id = None
        saved_sesi = Sesi.query.get(sesi.id)
        self.assertIsNotNone(saved_sesi)
        self.assertIsNone(saved_sesi.pc_id)

        # Verification: Category C (Grup) is preserved
        self.assertIsNotNone(Grup.query.get(self.grup.id))

        # Verification: In-memory state cleared
        self.assertNotIn(pc_id, TELEMETRY_HISTORY)
        self.assertNotIn(pc_id, PENDING_COMMANDS)

    def test_delete_pc_blocked_when_active_session_exists(self):
        # Create active session on PC
        sesi = Sesi(tipe="guest", nama_guest="Andi", pc_id=self.pc.id, status="aktif")
        db.session.add(sesi)
        db.session.commit()

        # Deletion must be rejected
        with self.assertRaises(ValueError) as ctx:
            PCService.delete(self.pc.id, operator="admin")
        self.assertIn("sesi aktif", str(ctx.exception).lower())

        # PC and session must still exist
        self.assertIsNotNone(PC.query.get(self.pc.id))

if __name__ == "__main__":
    unittest.main()
