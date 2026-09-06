# tests/test_branch_refresh_loop_prevention.py
import pytest
from app import create_app, db
from app.models.branch import Branch
from app.models import User

@pytest.fixture
def refresh_setup():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_test", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)

        branch = Branch(nama="Cabang Timur", url="http://192.168.30.10:7015", api_key="secret-key-456", aktif=True)
        db.session.add(branch)
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as sess:
            sess['kasir_id'] = admin.id
            sess['kasir_username'] = admin.username
            sess['kasir_role'] = 'admin'
            sess['active_branch_id'] = branch.id
            sess['active_branch_name'] = branch.nama

        yield client, app, branch
        db.session.remove()
        db.drop_all()

def test_dashboard_does_not_nuke_active_branch_session_on_refresh(refresh_setup):
    """Memastikan route dashboard '/' tidak menghapus active_branch_id dari session saat refresh."""
    client, app, branch = refresh_setup

    res = client.get('/kasir/')
    assert res.status_code == 200

    # Verifikasi bahwa session active_branch_id tidak di-pop secara destruktif
    with client.session_transaction() as sess:
        assert sess.get('active_branch_id') == branch.id
        assert sess.get('active_branch_name') == branch.nama
