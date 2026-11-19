from unittest.mock import patch, MagicMock
import pytest
from app import create_app
from app.models import db, PC, User
from app.services import ClientService
from app.services.report.log_audit_service import LogAuditService


def test_client_service_get_status_rolls_back_on_exception():
    """Memastikan ClientService.get_status memanggil db.session.rollback() saat terjadi exception."""
    app = create_app()
    with app.app_context():
        with patch.object(db.session, "rollback") as mock_rollback:
            with patch("app.repositories.pc.pc_repository.PCRepository.get_by_ip", side_effect=RuntimeError("DB Crash Simulation")):
                res = ClientService.get_status("192.168.1.99", "AA:BB:CC:DD:EE:FF")
                assert res.get("status") == "error"
                mock_rollback.assert_called_once()


def test_client_service_tutup_sesi_rolls_back_on_exception():
    """Memastikan ClientService.tutup_sesi memanggil db.session.rollback() saat terjadi exception."""
    app = create_app()
    with app.app_context():
        with patch.object(db.session, "rollback") as mock_rollback:
            with patch("app.repositories.pc.pc_repository.PCRepository.get_by_ip", side_effect=RuntimeError("DB Commit Crash")):
                res = ClientService.tutup_sesi("192.168.1.99", "AA:BB:CC:DD:EE:FF")
                assert res.get("success") is False
                mock_rollback.assert_called_once()


def test_log_audit_service_operations_roll_back_on_exception():
    """Memastikan LogAuditService memanggil db.session.rollback() jika operasi hapus gagal."""
    app = create_app()
    with app.app_context():
        with patch.object(db.session, "rollback") as mock_rollback:
            with patch("app.repositories.transaksi.transaksi_repository.TransaksiRepository.delete_all", side_effect=RuntimeError("DB Lock")):
                res = LogAuditService.clear_all_transactions()
                assert res is False
                mock_rollback.assert_called_once()

        mock_t = MagicMock()
        mock_t.no_nota = "TRX-TEST-001"
        with patch.object(db.session, "rollback") as mock_rollback:
            with patch("app.repositories.transaksi.transaksi_repository.TransaksiRepository.get_by_id", return_value=mock_t):
                with patch("app.repositories.transaksi.transaksi_repository.TransaksiRepository.delete_by_id", side_effect=RuntimeError("DB Lock")):
                    res = LogAuditService.delete_transaction(1)
                    assert res is False
                    mock_rollback.assert_called_once()
