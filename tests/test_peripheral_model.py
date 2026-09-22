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

    def test_hardware_monitor_peripherals_fields(self):
        monitor = HardwareMonitor(
            pc_id=self.pc.id,
            peripherals_baseline='{"Mouse": "Razer DeathAdder", "Headset": "HyperX Cloud II"}',
            peripherals_current='{"Mouse": "Razer DeathAdder", "Headset": "HyperX Cloud II"}',
            peripherals_mismatch=False,
            peripherals_mismatch_desc=None,
            peripherals_disconnect_tracker=None
        )
        db.session.add(monitor)
        db.session.commit()

        fetched = HardwareMonitor.query.filter_by(pc_id=self.pc.id).first()
        self.assertIsNotNone(fetched)
        self.assertIn("HyperX Cloud II", fetched.peripherals_baseline)
        self.assertFalse(fetched.peripherals_mismatch)

        d = fetched.to_dict()
        self.assertIn("peripherals_baseline", d)
        self.assertIn("peripherals_current", d)
        self.assertIn("peripherals_mismatch", d)
        self.assertIn("peripherals_mismatch_desc", d)
        self.assertIn("peripherals_mismatch_time", d)
        self.assertIn("peripherals_disconnect_tracker", d)
