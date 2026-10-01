import unittest
from app import create_app
from app.models import db, HardwareMonitor, PC, Grup

class TestPeripheralModel(unittest.TestCase):
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

        self.pc = PC(kode="PC01", nama="PC 01", ip_address="192.168.1.10", mac_address="AA:BB:CC:DD:EE:01", grup_id=self.grup.id)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_hardware_monitor_internal_fields(self):
        monitor = HardwareMonitor(
            pc_id=self.pc.id,
            cpu_name="Intel Core i5-12400F",
            gpu_name="NVIDIA GeForce RTX 3060",
            total_ram="16 GB",
            motherboard="ASUS PRIME B660M-K",
            hardware_baseline='{"MotherboardSerial": "MB-123", "CpuId": "CPU-123"}',
            hardware_current_specs='{"MotherboardSerial": "MB-123", "CpuId": "CPU-123"}',
            hardware_mismatch=False,
            hardware_mismatch_desc=None
        )
        db.session.add(monitor)
        db.session.commit()

        fetched = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertIsNotNone(fetched)
        self.assertIn("MB-123", fetched.hardware_baseline)
        self.assertFalse(fetched.hardware_mismatch)

        d = fetched.to_dict()
        self.assertIn("hardware_baseline", d)
        self.assertIn("hardware_current_specs", d)
        self.assertIn("hardware_mismatch", d)
        self.assertIn("hardware_mismatch_desc", d)
        self.assertIn("hardware_mismatch_time", d)
        self.assertIn("hardware_cctv_window", d)
        # Pastikan kolom peripheral tidak ada lagi
        self.assertNotIn("peripherals_baseline", d)
        self.assertNotIn("peripherals_current", d)
        self.assertNotIn("peripherals_mismatch", d)
        self.assertNotIn("peripherals_mismatch_desc", d)
        self.assertNotIn("peripherals_mismatch_time", d)
        self.assertNotIn("peripherals_disconnect_tracker", d)
