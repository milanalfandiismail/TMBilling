import unittest
import json
from datetime import datetime, timedelta, timezone
from app import create_app
from app.models import db, HardwareMonitor, PC, Grup, PCUptimeLog
from app.services.hardware.hardware_service import HardwareService
from app.utils.timezone_utils import now_utc, format_display

class TestHardwareServiceLogic(unittest.TestCase):
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

    def test_auto_register_internal_hardware_baseline(self):
        payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "CpuUsage": 10.0,
            "TotalRam": "16 GB",
            "HardwareSerials": {
                "MotherboardSerial": "MB-123",
                "CpuId": "CPU-123",
                "GpuPnpId": "GPU-123",
                "RamSerials": ["RAM1", "RAM2"],
                "DiskSerials": ["DISK1"]
            }
        }
        HardwareService.process_hardware_metric("192.168.1.101", payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertIsNotNone(hw)
        self.assertIsNotNone(hw.hardware_baseline)
        self.assertIn("MB-123", hw.hardware_baseline)
        self.assertFalse(hw.hardware_mismatch)

    def test_backward_compatibility_ignores_peripherals_payload(self):
        # Client lama yang masih mengirim payload "Peripherals" harus diterima tanpa error
        legacy_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
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
        # Eksekusi tidak boleh melempar exception
        HardwareService.process_hardware_metric("192.168.1.101", legacy_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertIsNotNone(hw)
        self.assertFalse(hw.hardware_mismatch)
        # Model HardwareMonitor tidak boleh memiliki atribut peripheral
        self.assertFalse(hasattr(hw, "peripherals_baseline"))

    def test_internal_hardware_mismatch_detection(self):
        # 1. Baseline terdaftar
        initial_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "HardwareSerials": {
                "MotherboardSerial": "MB-123",
                "CpuId": "CPU-123",
                "GpuPnpId": "GPU-123",
                "RamSerials": ["RAM1", "RAM2"],
                "DiskSerials": ["DISK1"]
            }
        }
        HardwareService.process_hardware_metric("192.168.1.101", initial_payload)

        # 2. Kirim payload dengan GPU tertukar dan RAM hilang 1
        changed_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "HardwareSerials": {
                "MotherboardSerial": "MB-123",
                "CpuId": "CPU-123",
                "GpuPnpId": "GPU-SWAPPED-456",
                "RamSerials": ["RAM1"],  # RAM2 hilang
                "DiskSerials": ["DISK1"]
            }
        }
        HardwareService.process_hardware_metric("192.168.1.101", changed_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertTrue(hw.hardware_mismatch)
        self.assertIn("GPU/VGA", hw.hardware_mismatch_desc)
        self.assertIn("RAM", hw.hardware_mismatch_desc)
        self.assertIsNotNone(hw.hardware_cctv_window)

    def test_update_pc_baseline_resets_internal_hardware(self):
        hw = HardwareMonitor(
            pc_id=self.pc.id,
            hardware_baseline='{"MotherboardSerial": "OLD-MB"}',
            hardware_current_specs='{"MotherboardSerial": "NEW-MB"}',
            hardware_mismatch=True,
            hardware_mismatch_desc="Motherboard berubah",
            hardware_cctv_window="22/09/2026 14:00 WITA - 16:18 WITA (rentang PC mati sebelum boot)"
        )
        db.session.add(hw)
        db.session.commit()

        HardwareService.update_pc_baseline(self.pc.id, operator="admin")

        refreshed = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertFalse(refreshed.hardware_mismatch)
        self.assertIsNone(refreshed.hardware_mismatch_desc)
        self.assertIsNone(refreshed.hardware_cctv_window)
        self.assertIn("NEW-MB", refreshed.hardware_baseline)

    def test_format_cctv_internal_window_same_date(self):
        # Same date test
        start_dt = datetime(2026, 9, 22, 6, 0, tzinfo=timezone.utc)   # 14:00 WITA
        end_dt = datetime(2026, 9, 22, 8, 18, tzinfo=timezone.utc)    # 16:18 WITA
        window_str = HardwareService.format_cctv_internal_window(start_dt, end_dt)
        self.assertIn("22/09/2026 14:00 WITA", window_str)
        self.assertIn("16:18 WITA", window_str)
        self.assertIn("(rentang PC mati sebelum boot)", window_str)

    def test_gpu_theft_removal_detection(self):
        # 1. Baseline terdaftar dengan GPU fisik
        initial_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "GpuName": "NVIDIA GeForce RTX 4060",
            "HardwareSerials": {
                "MotherboardSerial": "MB-123",
                "CpuId": "CPU-123",
                "GpuPnpId": r"PCI\VEN_10DE&DEV_2882&SUBSYS_1234",
                "GpuName": "NVIDIA GeForce RTX 4060",
                "RamSerials": ["RAM1", "RAM2"],
                "DiskSerials": ["DISK1"]
            }
        }
        HardwareService.process_hardware_metric("192.168.1.101", initial_payload)

        # 2. Kirim payload saat GPU dicopot (menjadi Microsoft Basic Display Adapter / generic)
        theft_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "GpuName": "Microsoft Basic Display Adapter",
            "HardwareSerials": {
                "MotherboardSerial": "MB-123",
                "CpuId": "CPU-123",
                "GpuPnpId": r"ROOT\BASICDISPLAY\0000",
                "GpuName": "Microsoft Basic Display Adapter",
                "RamSerials": ["RAM1", "RAM2"],
                "DiskSerials": ["DISK1"]
            }
        }
        HardwareService.process_hardware_metric("192.168.1.101", theft_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertTrue(hw.hardware_mismatch)
        self.assertIn("GPU/VGA fisik dicopot atau hilang", hw.hardware_mismatch_desc)

    def test_gpu_model_swap_detection(self):
        # 1. Baseline terdaftar dengan RTX 4060
        initial_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "GpuName": "NVIDIA GeForce RTX 4060",
            "HardwareSerials": {
                "MotherboardSerial": "MB-123",
                "CpuId": "CPU-123",
                "GpuPnpId": r"PCI\VEN_10DE&DEV_2882",
                "GpuName": "NVIDIA GeForce RTX 4060",
                "RamSerials": ["RAM1"],
                "DiskSerials": ["DISK1"]
            }
        }
        HardwareService.process_hardware_metric("192.168.1.101", initial_payload)

        # 2. Kirim payload dengan GPU ditukar ke model lebih rendah (misal GTX 1050 Ti)
        swapped_payload = {
            "IpAddress": "192.168.1.101",
            "MacAddress": "AA:BB:CC:DD:EE:01",
            "GpuName": "NVIDIA GeForce GTX 1050 Ti",
            "HardwareSerials": {
                "MotherboardSerial": "MB-123",
                "CpuId": "CPU-123",
                "GpuPnpId": r"PCI\VEN_10DE&DEV_1C82",
                "GpuName": "NVIDIA GeForce GTX 1050 Ti",
                "RamSerials": ["RAM1"],
                "DiskSerials": ["DISK1"]
            }
        }
        HardwareService.process_hardware_metric("192.168.1.101", swapped_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertTrue(hw.hardware_mismatch)
        self.assertTrue("GPU/VGA ditukar" in hw.hardware_mismatch_desc or "Model GPU berubah" in hw.hardware_mismatch_desc)


    def test_format_cctv_internal_window_different_dates(self):
        # Overnight shutdown test
        start_dt = datetime(2026, 9, 22, 15, 0, tzinfo=timezone.utc)  # 23:00 WITA
        end_dt = datetime(2026, 9, 23, 0, 0, tzinfo=timezone.utc)     # 08:00 WITA next day
        window_str = HardwareService.format_cctv_internal_window(start_dt, end_dt)
        self.assertIn("22/09/2026 23:00 WITA", window_str)
        self.assertIn("23/09/2026 08:00 WITA", window_str)
        self.assertIn("(rentang PC mati sebelum boot)", window_str)
