import unittest
import json
from datetime import datetime, timedelta, timezone
from app import create_app
from app.models import db, HardwareMonitor, PC, Grup, PCUptimeLog
from app.services.hardware.hardware_service import HardwareService
from app.utils.timezone_utils import now_utc, format_display

class TestPeripheralServiceLogic(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        self.grup = Grup.query.filter_by(nama="reguler").first()
        if not self.grup:
            self.grup = Grup(nama="reguler", warna="#3b82f6")
            db.session.add(self.grup)
            db.session.commit()

        self.pc = PC(kode="PC01", nama="PC 01", ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01", grup_id=self.grup.id)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_auto_register_peripherals_baseline(self):
        payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "CpuUsage": 10.0,
            "TotalRam": "16 GB",
            "HardwareSerials": {
                "MotherboardSerial": "MB-123",
                "CpuId": "CPU-123",
                "GpuPnpId": "GPU-123",
                "RamSerials": ["RAM1"],
                "DiskSerials": ["DISK1"]
            },
            "Peripherals": {
                "Mouse": "Razer DeathAdder",
                "Keyboard": "Logitech G213",
                "Headset": "HyperX Cloud II"
            }
        }
        HardwareService.process_hardware_metric("192.168.1.101", payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertIsNotNone(hw)
        self.assertIsNotNone(hw.peripherals_baseline)
        self.assertIn("HyperX Cloud II", hw.peripherals_baseline)
        self.assertFalse(hw.peripherals_mismatch)

    def test_peripheral_disconnect_under_5_minutes_grace_period(self):
        # 1. Register initial baseline
        initial_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "HardwareSerials": {"MotherboardSerial": "MB-123", "CpuId": "CPU-123", "GpuPnpId": "GPU-123", "RamSerials": ["RAM1"], "DiskSerials": ["DISK1"]},
            "Peripherals": {"Mouse": "Razer DeathAdder", "Keyboard": "Logitech G213", "Headset": "HyperX Cloud II"}
        }
        HardwareService.process_hardware_metric("192.168.1.101", initial_payload)

        # 2. Payload missing Headset (e.g. user temporarily unplugged it 1 minute ago)
        missing_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "HardwareSerials": {"MotherboardSerial": "MB-123", "CpuId": "CPU-123", "GpuPnpId": "GPU-123", "RamSerials": ["RAM1"], "DiskSerials": ["DISK1"]},
            "Peripherals": {"Mouse": "Razer DeathAdder", "Keyboard": "Logitech G213"} # Headset missing
        }
        HardwareService.process_hardware_metric("192.168.1.101", missing_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        # Mismatch must still be False because 5 minutes grace period has not expired
        self.assertFalse(hw.peripherals_mismatch)
        self.assertIsNotNone(hw.peripherals_disconnect_tracker)
        tracker = json.loads(hw.peripherals_disconnect_tracker)
        self.assertIn("Headset", tracker)

        # 3. User reconnects headset within grace period
        reconnected_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "HardwareSerials": {"MotherboardSerial": "MB-123", "CpuId": "CPU-123", "GpuPnpId": "GPU-123", "RamSerials": ["RAM1"], "DiskSerials": ["DISK1"]},
            "Peripherals": {"Mouse": "Razer DeathAdder", "Keyboard": "Logitech G213", "Headset": "HyperX Cloud II"}
        }
        HardwareService.process_hardware_metric("192.168.1.101", reconnected_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertFalse(hw.peripherals_mismatch)
        tracker = json.loads(hw.peripherals_disconnect_tracker or "{}")
        self.assertNotIn("Headset", tracker)

    def test_peripheral_disconnect_exceeding_5_minutes_triggers_alert(self):
        # 1. Register baseline
        initial_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "HardwareSerials": {"MotherboardSerial": "MB-123", "CpuId": "CPU-123", "GpuPnpId": "GPU-123", "RamSerials": ["RAM1"], "DiskSerials": ["DISK1"]},
            "Peripherals": {"Mouse": "Razer DeathAdder", "Keyboard": "Logitech G213", "Headset": "HyperX Cloud II"}
        }
        HardwareService.process_hardware_metric("192.168.1.101", initial_payload)

        # 2. Simulate disconnect 6 minutes ago in tracker
        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        six_mins_ago = now_utc() - timedelta(minutes=6)
        hw.peripherals_disconnect_tracker = json.dumps({
            "Headset": {
                "disconnected_at": six_mins_ago.isoformat(),
                "baseline": "HyperX Cloud II"
            }
        })
        db.session.commit()

        # 3. Next telemetry still missing Headset
        missing_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "HardwareSerials": {"MotherboardSerial": "MB-123", "CpuId": "CPU-123", "GpuPnpId": "GPU-123", "RamSerials": ["RAM1"], "DiskSerials": ["DISK1"]},
            "Peripherals": {"Mouse": "Razer DeathAdder", "Keyboard": "Logitech G213"}
        }
        HardwareService.process_hardware_metric("192.168.1.101", missing_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertTrue(hw.peripherals_mismatch)
        self.assertIn("Headset", hw.peripherals_mismatch_desc)
        self.assertIn("CCTV", hw.peripherals_mismatch_desc)
        self.assertIsNotNone(hw.peripherals_mismatch_time)

    def test_update_pc_baseline_resets_both_internal_and_peripherals(self):
        hw = HardwareMonitor(
            pc_id=self.pc.id,
            hardware_baseline='{"MotherboardSerial": "OLD-MB"}',
            hardware_current_specs='{"MotherboardSerial": "NEW-MB"}',
            hardware_mismatch=True,
            hardware_mismatch_desc="Motherboard berubah",
            peripherals_baseline='{"Headset": "Old Headset"}',
            peripherals_current='{"Headset": "New Headset"}',
            peripherals_mismatch=True,
            peripherals_mismatch_desc="Headset dicabut",
            peripherals_disconnect_tracker='{"Headset": {"disconnected_at": "2026-09-23T00:00:00Z"}}'
        )
        db.session.add(hw)
        db.session.commit()

        HardwareService.update_pc_baseline(self.pc.id, operator="admin")

        refreshed = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertFalse(refreshed.hardware_mismatch)
        self.assertFalse(refreshed.peripherals_mismatch)
        self.assertIsNone(refreshed.hardware_mismatch_desc)
        self.assertIsNone(refreshed.peripherals_mismatch_desc)
        self.assertIsNone(refreshed.peripherals_disconnect_tracker)
        self.assertIn("NEW-MB", refreshed.hardware_baseline)
        self.assertIn("New Headset", refreshed.peripherals_baseline)
