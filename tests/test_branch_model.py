# tests/test_branch_model.py
import pytest
from app import create_app
from app.models import db
from app.models.branch import Branch

@pytest.fixture
def app_instance():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

def test_branch_model_crud(app_instance):
    with app_instance.app_context():
        branch = Branch(
            nama="TM-Esports Belida",
            url="https://tm2billing.milannn.my.id",
            api_key="tmb_sec_test_secret_key_12345",
            aktif=True
        )
        db.session.add(branch)
        db.session.commit()

        saved = Branch.query.filter_by(nama="TM-Esports Belida").first()
        assert saved is not None
        assert saved.url == "https://tm2billing.milannn.my.id"
        assert saved.api_key == "tmb_sec_test_secret_key_12345"
        assert saved.aktif is True

        # Test to_dict masking api_key by default
        data_safe = saved.to_dict()
        assert "api_key" not in data_safe
        assert data_safe["nama"] == "TM-Esports Belida"

        data_full = saved.to_dict(include_key=True)
        assert data_full["api_key"] == "tmb_sec_test_secret_key_12345"
