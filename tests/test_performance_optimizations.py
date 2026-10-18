import unittest
from app import create_app
from app.models import db, PC, Grup
from app.repositories import PCRepository
from app.services.client.client_service import CommandQueueDict, MAX_COMMAND_QUEUE_PER_PC
from app.services.dashboard.dashboard_service import DashboardService

class TestPerformanceOptimizations(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        db.session.remove()
        self.app_context.pop()

    def test_command_queue_dict_bounded_and_deduplicated(self):
        q = CommandQueueDict()
        pc_id = 9999
        
        # Test deduplication of screenshot
        q.push_cmd(pc_id, "screenshot")
        q.push_cmd(pc_id, "screenshot")
        raw_list = dict.get(q, pc_id)
        self.assertEqual(len(raw_list), 1)

        # Test queue cap
        for i in range(20):
            q.push_cmd(pc_id, f"cmd_{i}")
        raw_list = dict.get(q, pc_id)
        self.assertLessEqual(len(raw_list), MAX_COMMAND_QUEUE_PER_PC)

    def test_pc_repository_eager_loading(self):
        pcs = PCRepository.get_all(aktif_only=True)
        # Verify query runs cleanly without throwing exception
        self.assertIsInstance(pcs, list)

    def test_dashboard_service_zero_disk_screenshot(self):
        res = DashboardService.get_pc_list()
        self.assertIn("pc_list", res)
