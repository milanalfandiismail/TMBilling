# tests/test_branch_inbound_connections.py
"""Test suite untuk fitur List Koneksi Cabang (Inbound Connections)."""

import pytest
from app import create_app
from app.models import db
from app.models.branch import BranchInbound


@pytest.fixture
def app_instance():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_branch_inbound_model_crud_and_to_dict(app_instance):
    """Memastikan model BranchInbound dapat disimpan dan diserialisasi dengan benar."""
    with app_instance.app_context():
        inbound = BranchInbound(
            nama="Cabang Server A",
            url="https://server-a.milannn.my.id",
            mac_address="00:1A:2B:3C:4D:5E",
            ip_address="192.168.1.100",
            operator_terakhir="kasir1",
        )
        db.session.add(inbound)
        db.session.commit()

        saved = BranchInbound.query.filter_by(nama="Cabang Server A").first()
        assert saved is not None
        assert saved.mac_address == "00:1A:2B:3C:4D:5E"
        assert saved.ip_address == "192.168.1.100"
        assert saved.operator_terakhir == "kasir1"
        assert saved.total_request == 1
        assert saved.status == "aktif"
        assert saved.pertama_terhubung is not None
        assert saved.terakhir_aktif is not None

        # Test to_dict
        d = saved.to_dict()
        assert d["nama"] == "Cabang Server A"
        assert d["url"] == "https://server-a.milannn.my.id"
        assert d["mac_address"] == "00:1A:2B:3C:4D:5E"
        assert d["ip_address"] == "192.168.1.100"
        assert d["operator_terakhir"] == "kasir1"
        assert d["total_request"] == 1
        assert d["status"] == "aktif"
        assert "pertama_terhubung" in d
        assert "terakhir_aktif" in d


def test_branch_inbound_service_record_and_update(app_instance):
    """Memastikan record_inbound_access membuat record baru atau memperbarui existing."""
    from app.services.branch.branch_inbound_service import BranchInboundService

    with app_instance.app_context():
        # 1. Insert baru
        rec1 = BranchInboundService.record_inbound_access(
            origin_name="Cabang Delta",
            origin_mac="AA:BB:CC:DD:EE:FF",
            origin_url="http://delta.local",
            operator="op_delta",
            ip_address="10.0.0.5"
        )
        assert rec1.id is not None
        assert rec1.nama == "Cabang Delta"
        assert rec1.total_request == 1

        # 2. Update existing via MAC
        rec2 = BranchInboundService.record_inbound_access(
            origin_name="Cabang Delta Renamed",
            origin_mac="AA:BB:CC:DD:EE:FF",
            origin_url="http://delta.local",
            operator="op_new",
            ip_address="10.0.0.6"
        )
        assert rec2.id == rec1.id
        assert rec2.total_request == 2
        assert rec2.operator_terakhir == "op_new"
        assert rec2.ip_address == "10.0.0.6"


def test_branch_inbound_service_block_unblock_delete(app_instance):
    """Memastikan toggle_block, is_blocked, dan delete_inbound bekerja sesuai aturan."""
    from app.services.branch.branch_inbound_service import BranchInboundService

    with app_instance.app_context():
        rec = BranchInboundService.record_inbound_access(
            origin_name="Cabang Rogue",
            origin_mac="11:22:33:44:55:66",
            operator="hacker"
        )
        assert BranchInboundService.is_blocked("Cabang Rogue", "11:22:33:44:55:66") is False

        # Blokir
        ok, res = BranchInboundService.toggle_block(rec.id, block=True)
        assert ok is True
        assert res["status"] == "diblokir"
        assert BranchInboundService.is_blocked("Cabang Rogue", "11:22:33:44:55:66") is True
        assert BranchInboundService.is_blocked("Cabang Rogue", None) is True
        assert BranchInboundService.is_blocked(None, "11:22:33:44:55:66") is True

        # Unblock
        ok, res = BranchInboundService.toggle_block(rec.id, block=False)
        assert ok is True
        assert res["status"] == "aktif"
        assert BranchInboundService.is_blocked("Cabang Rogue", "11:22:33:44:55:66") is False

        # Get all
        all_inbound = BranchInboundService.get_all_inbound()
        assert len(all_inbound) == 1
        assert all_inbound[0]["nama"] == "Cabang Rogue"

        # Delete
        ok, msg = BranchInboundService.delete_inbound(rec.id)
        assert ok is True
        assert len(BranchInboundService.get_all_inbound()) == 0

