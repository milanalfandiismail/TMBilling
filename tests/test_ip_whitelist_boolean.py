import pytest
from app import create_app, db
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield


def test_enabled_string_false_menonaktifkan(ctx):
    IpWhitelistService.set_enabled("false")

    assert IpWhitelistService.is_enabled() is False
