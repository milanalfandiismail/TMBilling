# tests/test_branch_auth_middleware.py
import pytest
from app import create_app
from app.models import db
from app.services import SettingsService

@pytest.fixture
def client_app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        # Set api key
        SettingsService.set("branch_api_key", "tmb_sec_valid_token_12345")
        yield app.test_client()
        db.session.remove()
        db.drop_all()

def test_endpoint_denied_without_auth(client_app):
    # Akses endpoint kasir tanpa session dan tanpa bearer token
    res = client_app.get('/api/v1/kasir/dashboard/pc')
    assert res.status_code == 401

def test_endpoint_allowed_with_valid_bearer_token(client_app):
    headers = {"Authorization": "Bearer tmb_sec_valid_token_12345"}
    res = client_app.get('/api/v1/kasir/dashboard/pc', headers=headers)
    assert res.status_code == 200

def test_endpoint_denied_with_invalid_bearer_token(client_app):
    headers = {"Authorization": "Bearer tmb_sec_salah_total_99999"}
    res = client_app.get('/api/v1/kasir/dashboard/pc', headers=headers)
    assert res.status_code == 403
