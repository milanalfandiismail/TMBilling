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
