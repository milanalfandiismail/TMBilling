# tests/test_dashboard_nic_speed.py
import unittest
from app import create_app
from app.models import db, PC, Grup, HardwareMonitor
from app.services.dashboard.dashboard_service import DashboardService

class TestDashboardNicSpeed(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        self.grup = Grup(nama="vip", warna="#8b5cf6")
        db.session.add(self.grup)
        db.session.commit()

        self.pc = PC(kode="PC01", nama="PC 01", ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01", grup_id=self.grup.id, aktif=True)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_get_pc_list_includes_nic_speed_when_hardware_present(self):
        hw = HardwareMonitor(pc_id=self.pc.id, nic_speed="100 Mbps", active_window="Dota 2")
        db.session.add(hw)
        db.session.commit()

        res = DashboardService.get_pc_list()
        pc_item = next(p for p in res["pc_list"] if p["id"] == self.pc.id)
        self.assertIn("nic_speed", pc_item)
        self.assertEqual(pc_item["nic_speed"], "100 Mbps")

    def test_get_pc_list_handles_none_nic_speed_when_hardware_absent(self):
        res = DashboardService.get_pc_list()
        pc_item = next(p for p in res["pc_list"] if p["id"] == self.pc.id)
        self.assertIn("nic_speed", pc_item)
        self.assertIsNone(pc_item["nic_speed"])
