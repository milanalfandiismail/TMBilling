# tests/test_branch_ui_rendering.py
import pytest
from app import create_app
from app.models import db, User

@pytest.fixture
def test_clients():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_ui", role="admin", aktif=True)
        admin.set_password("admin123")
        db.session.add(admin)

        kasir = User(username="kasir_ui", role="kasir", aktif=True)
        kasir.set_password("kasir123")
        db.session.add(kasir)
        db.session.commit()

        client_admin = app.test_client()
        with client_admin.session_transaction() as sess:
            sess['kasir_id'] = admin.id
            sess['kasir_username'] = admin.username
            sess['kasir_role'] = 'admin'

        client_kasir = app.test_client()
        with client_kasir.session_transaction() as sess:
            sess['kasir_id'] = kasir.id
            sess['kasir_username'] = kasir.username
            sess['kasir_role'] = 'kasir'

        yield client_admin, client_kasir
        db.session.remove()
        db.drop_all()

def test_admin_sees_branch_selector_and_settings_tab(test_clients):
    client_admin, _ = test_clients
    res = client_admin.get('/kasir/')
    assert res.status_code == 200
    html = res.get_data(as_text=True)

    # Memastikan dropdown navbar ada untuk admin
    assert 'id="branch-selector-container"' in html
    assert 'id="branch-selector-btn"' in html

    # Memastikan script branch dimuat
    assert 'js/kasir/modules/branch/index.js' in html

    # Memastikan tab multi-cabang dan menu sidebar ada untuk admin
    assert 'id="tab-branch"' in html
    assert 'id="sidebar-tab-branch"' in html
    assert 'id="tab-btn-settings-branch"' in html
    assert 'id="modal-branch-title"' in html
    assert 'id="input-branch-id"' in html

def test_kasir_does_not_see_branch_selector_or_tab(test_clients):
    _, client_kasir = test_clients
    res = client_kasir.get('/kasir/')
    assert res.status_code == 200
    html = res.get_data(as_text=True)

    # Kasir biasa tidak boleh melihat dropdown switch cabang, tab, maupun menu sidebar (Zero UI)
    assert 'id="branch-selector-container"' not in html
    assert 'id="tab-branch"' not in html
    assert 'id="sidebar-tab-branch"' not in html
